package made.simple.replog.dto;

import java.util.List;
import java.util.UUID;

public record GroupDto(
    UUID id,
    String name,
    Integer order,
    List<ExerciseDto> exercises
) {}