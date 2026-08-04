package made.simple.replog.repository;

import made.simple.replog.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByUsername(String username);
    boolean existsByUsername(String username);

    /**
     * Atomically claims a migration user: sets username and password,
     * clears the migration token. Returns number of rows affected (1 = success, 0 = failure).
     */
    @Modifying
    @Query("""
        UPDATE User u
        SET u.username = :username,
            u.password = :passwordHash,
            u.migrationToken = NULL,
            u.migrationTokenCreatedAt = NULL
        WHERE u.migrationToken = :token
          AND u.migrationTokenCreatedAt > :ttlCutoff
          AND u.username IS NULL
    """)
    int claimMigrationUser(@Param("token") UUID token,
                           @Param("username") String username,
                           @Param("passwordHash") String passwordHash,
                           @Param("ttlCutoff") Instant ttlCutoff);

    /**
     * Deletes all unclaimed users whose migration token has expired.
     * Returns the count of deleted users.
     */
    @Modifying
    @Query("""
        DELETE FROM User u
        WHERE u.migrationToken IS NOT NULL
          AND u.migrationTokenCreatedAt < :cutoff
    """)
    int deleteExpiredMigrations(@Param("cutoff") Instant cutoff);
}

