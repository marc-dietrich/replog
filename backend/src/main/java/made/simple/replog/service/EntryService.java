package made.simple.replog.service;

import made.simple.replog.dto.CreateEntryRequest;
import made.simple.replog.dto.EntryDto;
import made.simple.replog.dto.PagedEntriesDto;
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

    @Transactional
    public EntryDto create(CreateEntryRequest request) {
        Exercise exercise = exerciseRepository.findById(request.exerciseId())
            .orElseThrow(() -> new EntityNotFoundException("Exercise nicht gefunden: " + request.exerciseId()));

        Entry entry = new Entry();
        entry.setUserId(currentUserProvider.getCurrentUserId());
        entry.setDate(request.date());
        entry.setWeight(request.weight());
        entry.setReps(request.reps());
        entry.setNote(request.note());
        entry.setExercise(exercise);

        Entry saved = entryRepository.save(entry);
        return toDto(saved);
    }

    @Transactional
    public void delete(UUID id) {
        if (!entryRepository.existsById(id)) {
            throw new EntityNotFoundException("Entry nicht gefunden: " + id);
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
        return new EntryDto(entry.getId(), entry.getDate(), entry.getWeight(), entry.getReps(), entry.getNote());
    }
}