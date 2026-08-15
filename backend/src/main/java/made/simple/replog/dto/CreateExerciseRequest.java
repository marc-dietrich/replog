package made.simple.replog.dto;

import java.time.Instant;
import java.util.UUID;

public record CreateExerciseRequest(
        UUID id,
        String name,
        Integer order,
        UUID groupId,
        Instant createdAt,
        Instant updatedAt) {
}