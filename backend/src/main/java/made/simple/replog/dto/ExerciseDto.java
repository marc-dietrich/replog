package made.simple.replog.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ExerciseDto(
    UUID id,
    String name,
    Integer order,
    List<EntryDto> entries,
    UUID groupId,
    Instant createdAt,
    Instant updatedAt
) {}