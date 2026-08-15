package made.simple.replog.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * Full replacement update for an exercise (F2). The complete new state is
 * carried — no patch/partial semantics. Also used for offline reorders,
 * which are plain `update` ops with the full new state (Q4).
 */
public record UpdateExerciseRequest(
        String name,
        Integer order,
        UUID groupId,
        Instant createdAt,
        Instant updatedAt) {
}
