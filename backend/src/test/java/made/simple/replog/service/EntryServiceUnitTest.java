package made.simple.replog.service;

import made.simple.replog.dto.CreateEntryRequest;
import made.simple.replog.dto.EntryDto;
import made.simple.replog.dto.PagedEntriesDto;
import made.simple.replog.dto.UpdateEntryRequest;
import made.simple.replog.model.Entry;
import made.simple.replog.model.Exercise;
import made.simple.replog.repository.EntryRepository;
import made.simple.replog.repository.ExerciseRepository;
import made.simple.replog.security.CurrentUserProvider;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EntryServiceUnitTest {

    @Mock
    private EntryRepository entryRepository;

    @Mock
    private ExerciseRepository exerciseRepository;

    @Mock
    private CurrentUserProvider currentUserProvider;

    private EntryService entryService;

    @BeforeEach
    void setUp() {
        entryService = new EntryService(entryRepository, exerciseRepository, currentUserProvider);
    }

    // ── Create ────────────────────────────────────────────────────────

    @Test
    void create_isIdempotent_forKnownClientUuid() {
        UUID entryId = UUID.randomUUID();
        Entry existing = createEntry(entryId, LocalDate.of(2026, 7, 26), 100, 5);

        CreateEntryRequest request = new CreateEntryRequest(entryId, LocalDate.of(2026, 7, 26),
                BigDecimal.valueOf(100), 5, "", UUID.randomUUID(), Instant.now(), Instant.now());

        when(entryRepository.findById(entryId)).thenReturn(Optional.of(existing));

        EntryDto result = entryService.create(request);

        assertThat(result.id()).isEqualTo(entryId);
        // Retry must not persist a second entity (Q2)
        verify(entryRepository, never()).save(any());
    }

    @Test
    void create_requiresClientUuid() {
        CreateEntryRequest request = new CreateEntryRequest(null, LocalDate.of(2026, 7, 26),
                BigDecimal.valueOf(100), 5, "", UUID.randomUUID(), Instant.now(), Instant.now());

        assertThatThrownBy(() -> entryService.create(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("id");
    }

    // ── Delete (F1: idempotent no-op) ─────────────────────────────────

    @Test
    void delete_isNoOp_whenEntryDoesNotExist() {
        UUID unknownId = UUID.randomUUID();
        when(entryRepository.existsById(unknownId)).thenReturn(false);

        entryService.delete(unknownId);

        verify(entryRepository, never()).deleteById(any());
    }

    // ── Update (F2: full payload replacement) ─────────────────────────

    @Test
    void update_replacesFullPayload() {
        UUID entryId = UUID.randomUUID();
        Entry existing = createEntry(entryId, LocalDate.of(2026, 7, 26), 100, 5);

        Instant createdAt = Instant.parse("2026-07-26T10:00:00Z");
        Instant updatedAt = Instant.parse("2026-07-27T10:00:00Z");
        UpdateEntryRequest request = new UpdateEntryRequest(LocalDate.of(2026, 7, 27),
                BigDecimal.valueOf(120), 3, "PR", createdAt, updatedAt);

        when(entryRepository.findById(entryId)).thenReturn(Optional.of(existing));
        when(entryRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        EntryDto result = entryService.update(entryId, request);

        assertThat(result.date()).isEqualTo(LocalDate.of(2026, 7, 27));
        assertThat(result.weight()).isEqualByComparingTo("120");
        assertThat(result.reps()).isEqualTo(3);
        assertThat(result.note()).isEqualTo("PR");
        assertThat(result.createdAt()).isEqualTo(createdAt);
        assertThat(result.updatedAt()).isEqualTo(updatedAt);
    }

    @Test
    void update_throwsWhenEntryNotFound() {
        UUID unknownId = UUID.randomUUID();
        when(entryRepository.findById(unknownId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> entryService.update(unknownId,
                new UpdateEntryRequest(LocalDate.now(), BigDecimal.ONE, 1, "", null, Instant.now())))
                .isInstanceOf(EntityNotFoundException.class)
                .hasMessageContaining(unknownId.toString());
    }

    // ── List ──────────────────────────────────────────────────────────

    @Test
    void listForExercise_throwsWhenExerciseNotFound() {
        UUID exerciseId = UUID.randomUUID();
        when(exerciseRepository.existsById(exerciseId)).thenReturn(false);

        assertThatThrownBy(() -> entryService.listForExercise(exerciseId, 0, 10))
                .isInstanceOf(EntityNotFoundException.class)
                .hasMessageContaining(exerciseId.toString());
    }

    @Test
    void listForExercise_returnsPaginatedEntries() {
        UUID exerciseId = UUID.randomUUID();
        Exercise exercise = new Exercise();
        exercise.setId(exerciseId);

        Entry entry1 = createEntry(UUID.randomUUID(), LocalDate.of(2026, 7, 26), 100, 5);
        Entry entry2 = createEntry(UUID.randomUUID(), LocalDate.of(2026, 7, 25), 95, 5);

        when(exerciseRepository.existsById(exerciseId)).thenReturn(true);
        when(entryRepository.countByExerciseId(exerciseId)).thenReturn(5L);
        when(entryRepository.findByExerciseIdOrderByDateDesc(
                eq(exerciseId), any(PageRequest.class)))
                .thenReturn(List.of(entry1, entry2));

        PagedEntriesDto result = entryService.listForExercise(exerciseId, 0, 2);

        assertThat(result.exerciseId()).isEqualTo(exerciseId);
        assertThat(result.totalCount()).isEqualTo(5);
        assertThat(result.offset()).isEqualTo(0);
        assertThat(result.limit()).isEqualTo(2);
        assertThat(result.entries()).hasSize(2);
        assertThat(result.entries().get(0).date()).isEqualTo(LocalDate.of(2026, 7, 26));
        assertThat(result.entries().get(1).date()).isEqualTo(LocalDate.of(2026, 7, 25));
    }

    @Test
    void listForExercise_handlesEmptyResult() {
        UUID exerciseId = UUID.randomUUID();

        when(exerciseRepository.existsById(exerciseId)).thenReturn(true);
        when(entryRepository.countByExerciseId(exerciseId)).thenReturn(0L);
        when(entryRepository.findByExerciseIdOrderByDateDesc(
                eq(exerciseId), any(PageRequest.class)))
                .thenReturn(List.of());

        PagedEntriesDto result = entryService.listForExercise(exerciseId, 0, 50);

        assertThat(result.totalCount()).isEqualTo(0);
        assertThat(result.entries()).isEmpty();
    }

    @Test
    void listForExercise_respectsOffset() {
        UUID exerciseId = UUID.randomUUID();
        Entry entry3 = createEntry(UUID.randomUUID(), LocalDate.of(2026, 7, 24), 80, 8);

        when(exerciseRepository.existsById(exerciseId)).thenReturn(true);
        when(entryRepository.countByExerciseId(exerciseId)).thenReturn(10L);
        when(entryRepository.findByExerciseIdOrderByDateDesc(
                eq(exerciseId), eq(PageRequest.of(1, 5))))
                .thenReturn(List.of(entry3));

        PagedEntriesDto result = entryService.listForExercise(exerciseId, 5, 5);

        // offset=5, limit=5 → page 1 (5/5=1)
        assertThat(result.offset()).isEqualTo(5);
        assertThat(result.entries()).hasSize(1);
        assertThat(result.totalCount()).isEqualTo(10);
    }

    private Entry createEntry(UUID id, LocalDate date, int weight, int reps) {
        Entry entry = new Entry();
        entry.setId(id);
        entry.setDate(date);
        entry.setWeight(BigDecimal.valueOf(weight));
        entry.setReps(reps);
        return entry;
    }
}
