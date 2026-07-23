package made.simple.replog.dto;

import java.util.UUID;

public record CreateExerciseRequest(
        String name,
        Integer order,
        UUID groupId) {
}