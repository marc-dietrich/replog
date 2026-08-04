package made.simple.replog.dto;

import java.util.List;

public record MigrateGroupDto(
    String name,
    Integer order,
    List<MigrateExerciseDto> exercises
) {}