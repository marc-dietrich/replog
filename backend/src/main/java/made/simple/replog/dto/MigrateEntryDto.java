package made.simple.replog.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record MigrateEntryDto(
    UUID uuid,
    LocalDate date,
    BigDecimal weight,
    Integer reps,
    String note,
    Instant createdAt,
    Instant updatedAt
) {}