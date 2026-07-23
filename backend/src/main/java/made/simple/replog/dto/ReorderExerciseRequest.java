package made.simple.replog.dto;

import java.util.UUID;

public record ReorderExerciseRequest(
    UUID exerciseId,
    UUID targetGroupId,
    Integer newOrder
) {}