package made.simple.replog.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import made.simple.replog.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Scheduled job that deletes unclaimed migration users whose token has expired,
 * along with all their related data (groups, exercises, entries).
 * Runs daily at 3 AM by default.
 */
@Component
public class MigrationCleanupJob {

    private static final Logger log = LoggerFactory.getLogger(MigrationCleanupJob.class);

    private final UserRepository userRepository;

    @PersistenceContext
    private EntityManager entityManager;

    @Value("${app.migration.token-ttl-hours:48}")
    private int tokenTtlHours;

    public MigrationCleanupJob(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Scheduled(cron = "${app.migration.cleanup-cron:0 0 3 * * *}")
    @Transactional
    public void cleanupExpiredMigrations() {
        Instant cutoff = Instant.now().minus(Duration.ofHours(tokenTtlHours));

        // Find expired user IDs first
        @SuppressWarnings("unchecked")
        List<UUID> expiredUserIds = entityManager.createNativeQuery("""
            SELECT id FROM app_user
            WHERE migration_token IS NOT NULL
              AND migration_token_created_at < :cutoff
        """).setParameter("cutoff", cutoff).getResultList();

        if (expiredUserIds.isEmpty()) {
            return;
        }

        log.info("Found {} expired migration user(s) to clean up", expiredUserIds.size());

        // Delete related data in order (respecting FK constraints)
        for (UUID userId : expiredUserIds) {
            // Delete entries for this user
            entityManager.createNativeQuery(
                    "DELETE FROM entry WHERE user_id = :userId")
                    .setParameter("userId", userId)
                    .executeUpdate();

            // Delete exercises for this user
            entityManager.createNativeQuery(
                    "DELETE FROM exercise WHERE user_id = :userId")
                    .setParameter("userId", userId)
                    .executeUpdate();

            // Delete groups for this user
            entityManager.createNativeQuery(
                    "DELETE FROM exercise_group WHERE user_id = :userId")
                    .setParameter("userId", userId)
                    .executeUpdate();
        }

        // Now delete the users themselves
        int deleted = userRepository.deleteExpiredMigrations(cutoff);
        log.info("Cleaned up {} expired migration user(s)", deleted);
    }
}
