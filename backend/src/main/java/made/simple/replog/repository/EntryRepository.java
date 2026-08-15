package made.simple.replog.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import made.simple.replog.model.Entry;

public interface EntryRepository extends JpaRepository<Entry, UUID> {
    List<Entry> findByExerciseIdOrderByDateAsc(UUID exerciseId);

    List<Entry> findByExerciseIdOrderByDateDesc(UUID exerciseId, Pageable pageable);

    long countByExerciseId(UUID exerciseId);

    // Explicit cascade used by ExerciseService.delete (Q5)
    long deleteByExerciseId(UUID exerciseId);
}
