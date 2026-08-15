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
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;

@Service
public class EntryService {

    private final EntryRepository entryRepository;
    private final ExerciseRepository exerciseRepository;
    private final CurrentUserProvider currentUserProvider;

    public EntryService(EntryRepository entryRepository, ExerciseRepository exerciseRepository,
                         CurrentUserProvider currentUserProvider) {
        this.entryRepository = entryRepository;
        this.exerciseRepository = exerciseRepository;
        this.currentUserProvider = currentUserProvider;
    }

    /**
     * Idempotent create (Q2): a retried create with an already-known client
     * UUID returns the existing entity — retry after timeout is the normal
     * case, not a conflict.
     */
    @Transactional
    public EntryDto create(CreateEntryRequest request) {
        if (request.id() == null) {
            throw new IllegalArgumentException("id (client UUID) is required");
        }
        var existing = entryRepository.findById(request.id());
        if (existing.isPresent()) {
            return toDto(existing.get());
        }

        Exercise exercise = exerciseRepository.findById(request.exerciseId())
            .orElseThrow(() -> new EntityNotFoundException("Exercise nicht gefunden: " + request.exerciseId()));

        Entry entry = new Entry();
        entry.setId(request.id());
        entry.setUserId(currentUserProvider.getCurrentUserId());
        entry.setDate(request.date());
        entry.setWeight(request.weight());
        entry.setReps(request.reps());
        entry.setNote(request.note());
        entry.setCreatedAt(request.createdAt());
        entry.setUpdatedAt(request.updatedAt());
        entry.setExercise(exercise);

        Entry saved = entryRepository.save(entry);
        return toDto(saved);
    }

    /** Full payload replacement (F2) — no patch/partial semantics. */
    @Transactional
    public EntryDto update(UUID id, UpdateEntryRequest request) {
        Entry entry = entryRepository.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("Entry nicht gefunden: " + id));

        entry.setDate(request.date());
        entry.setWeight(request.weight());
        entry.setReps(request.reps());
        entry.setNote(request.note());
        // Client timestamps are taken over 1:1, never overridden server-side.
        if (request.createdAt() != null) {
            entry.setCreatedAt(request.createdAt());
        }
        entry.setUpdatedAt(request.updatedAt());

        return toDto(entryRepository.save(entry));
    }

    /** Idempotent delete (F1): deleting an already-deleted entry is a no-op. */
    @Transactional
    public void delete(UUID id) {
        if (!entryRepository.existsById(id)) {
            return; // target state already reached — no-op, not an error
        }
        entryRepository.deleteById(id);
    }

    @Transactional(readOnly = true)
    public PagedEntriesDto listForExercise(UUID exerciseId, int offset, int limit) {
        if (!exerciseRepository.existsById(exerciseId)) {
            throw new EntityNotFoundException("Exercise nicht gefunden: " + exerciseId);
        }

        long totalCount = entryRepository.countByExerciseId(exerciseId);
        var entries = entryRepository.findByExerciseIdOrderByDateDesc(
                exerciseId, PageRequest.of(offset / Math.max(limit, 1), limit));

        var entryDtos = entries.stream()
                .map(this::toDto)
                .toList();

        return new PagedEntriesDto(exerciseId, entryDtos, totalCount, offset, limit);
    }

    private EntryDto toDto(Entry entry) {
        return new EntryDto(entry.getId(), entry.getDate(), entry.getWeight(), entry.getReps(), entry.getNote(),
                entry.getCreatedAt(), entry.getUpdatedAt());
    }
}