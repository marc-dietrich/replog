package made.simple.replog.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import made.simple.replog.dto.ClaimRequest;
import made.simple.replog.dto.MigrateEntryDto;
import made.simple.replog.dto.MigrateExerciseDto;
import made.simple.replog.dto.MigrateGroupDto;
import made.simple.replog.dto.MigrateRequest;
import made.simple.replog.dto.MigrateResponse;
import made.simple.replog.dto.UserDto;
import made.simple.replog.model.Entry;
import made.simple.replog.model.Exercise;
import made.simple.replog.model.Group;
import made.simple.replog.model.User;
import made.simple.replog.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class MigrationService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @PersistenceContext
    private EntityManager entityManager;

    @Value("${app.migration.redirect-base-url:http://localhost:5173/migrate}")
    private String redirectBaseUrl;

    @Value("${app.migration.token-ttl-hours:48}")
    private int tokenTtlHours;

    public MigrationService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * Creates a new migration user with all provided data.
     * Exercises and groups come as flat lists — exercises reference groups
     * via a string {@code groupId} that maps to a group's old string {@code id}.
     * All entities carry client-generated UUIDs (R2) that become their PKs,
     * and client timestamps taken over 1:1.
     */
    @Transactional
    public MigrateResponse migrate(MigrateRequest request) {
        UUID migrationToken = UUID.randomUUID();
        User user = User.createMigrationUser(migrationToken);
        user = userRepository.save(user);

        setRlsContext(user.getId());

        // Step 1: create groups, mapping old string IDs → new Group entities
        Map<String, Group> groupByOldId = new HashMap<>();
        for (MigrateGroupDto groupDto : safeList(request.groups())) {
            Group group = new Group();
            group.setId(groupDto.uuid());
            group.setUserId(user.getId());
            group.setName(groupDto.name());
            group.setOrder(groupDto.order());
            group.setCreatedAt(groupDto.createdAt());
            group.setUpdatedAt(groupDto.updatedAt());
            entityManager.persist(group);
            if (groupDto.id() != null && !groupDto.id().isBlank()) {
                groupByOldId.put(groupDto.id(), group);
            }
        }

        // Step 2: create exercises, assigning to groups by old groupId
        for (MigrateExerciseDto exerciseDto : safeList(request.exercises())) {
            Exercise exercise = new Exercise();
            exercise.setId(exerciseDto.uuid());
            exercise.setUserId(user.getId());
            exercise.setName(exerciseDto.name());
            exercise.setOrder(exerciseDto.order());
            exercise.setCreatedAt(exerciseDto.createdAt());
            exercise.setUpdatedAt(exerciseDto.updatedAt());

            String oldGroupId = exerciseDto.groupId();
            if (oldGroupId != null && !oldGroupId.isBlank()) {
                exercise.setGroup(groupByOldId.get(oldGroupId));
            }

            entityManager.persist(exercise);
            persistEntries(user.getId(), exercise, safeList(exerciseDto.entries()));
        }

        entityManager.flush();

        String redirectUrl = redirectBaseUrl + "#token=" + migrationToken;
        return new MigrateResponse(redirectUrl);
    }

    /**
     * Atomically claims a migration user: verifies the token (including TTL),
     * sets username and password, clears the token, and logs the user in.
     * Returns the UserDto on success.
     *
     * @throws IllegalArgumentException if the token is invalid, expired, or already claimed
     */
    @Transactional
    public UserDto claim(UUID token, ClaimRequest request) {
        if (userRepository.existsByUsername(request.username())) {
            throw new IllegalArgumentException("Username already taken");
        }

        Instant ttlCutoff = Instant.now().minus(Duration.ofHours(tokenTtlHours));
        String passwordHash = passwordEncoder.encode(request.password());

        int affected = userRepository.claimMigrationUser(
                token, request.username(), passwordHash, ttlCutoff);

        if (affected == 0) {
            // Generic error — don't distinguish between invalid/expired/already-claimed
            throw new IllegalArgumentException("Invalid or expired migration token");
        }

        // Must flush and re-fetch to get the updated entity with username set
        entityManager.flush();
        entityManager.clear();

        User user = userRepository.findByUsername(request.username())
                .orElseThrow(() -> new IllegalStateException("Claim succeeded but user not found"));

        loginInSecurityContext(user);

        return new UserDto(user.getId(), user.getUsername());
    }

    private static <T> List<T> safeList(List<T> list) {
        return list != null ? list : Collections.emptyList();
    }

    private void persistEntries(UUID userId, Exercise exercise, List<MigrateEntryDto> entryDtos) {
        for (MigrateEntryDto entryDto : entryDtos) {
            Entry entry = new Entry();
            entry.setId(entryDto.uuid());
            entry.setUserId(userId);
            entry.setDate(entryDto.date());
            entry.setWeight(entryDto.weight());
            entry.setReps(entryDto.reps());
            entry.setNote(entryDto.note());
            entry.setCreatedAt(entryDto.createdAt());
            entry.setUpdatedAt(entryDto.updatedAt());
            entry.setExercise(exercise);
            entityManager.persist(entry);
        }
    }

    private void setRlsContext(UUID userId) {
        entityManager.createNativeQuery("SELECT set_config('app.current_user_id', :userId, true)")
                .setParameter("userId", userId.toString())
                .getSingleResult();
    }

    private void loginInSecurityContext(User user) {
        var auth = new UsernamePasswordAuthenticationToken(user.getId(), null, List.of());
        SecurityContextHolder.getContext().setAuthentication(auth);
    }
}
