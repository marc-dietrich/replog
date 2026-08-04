package made.simple.replog.dto;

import java.util.List;

public record MigrateExerciseDto(
    String name,
    Integer order,
    List<MigrateEntryDto> entries
) {}