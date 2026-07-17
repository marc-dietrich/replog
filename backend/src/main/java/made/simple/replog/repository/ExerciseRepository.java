package made.simple.replog.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import made.simple.replog.model.Exercise;

public interface ExerciseRepository extends JpaRepository<Exercise, UUID> {
    List<Exercise> findByGroupId(UUID groupId);
}
