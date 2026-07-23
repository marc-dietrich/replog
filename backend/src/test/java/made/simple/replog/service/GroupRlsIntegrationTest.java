package made.simple.replog.service;

import made.simple.replog.dto.CreateGroupRequest;
import made.simple.replog.dto.GroupDto;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Testcontainers
class GroupRlsIntegrationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    /**
     * WICHTIG: Zwei getrennte Rollen, statt einer gemeinsamen für Flyway und JPA.
     * - Flyway läuft weiterhin als Bootstrap-Superuser (braucht CREATE TABLE / CREATE ROLE Rechte)
     * - JPA/Hibernate (unsere eigentliche App-Logik) läuft als "replog_app" (KEIN Superuser)
     * Nur so kann RLS für den App-Traffic überhaupt greifen - Superuser umgehen RLS immer,
     * und der Bootstrap-User darf seine Superuser-Rechte nicht verlieren (Postgres verbietet das).
     */
    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.flyway.url", postgres::getJdbcUrl);
        registry.add("spring.flyway.user", postgres::getUsername);
        registry.add("spring.flyway.password", postgres::getPassword);

        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", () -> "replog_app");
        registry.add("spring.datasource.password", () -> "replog_app");
    }

    @BeforeAll
    static void createAppRole() throws Exception {
        postgres.start();
        var result = postgres.execInContainer(
            "psql", "-U", postgres.getUsername(), "-d", postgres.getDatabaseName(),
            "-c", "CREATE ROLE replog_app LOGIN PASSWORD 'replog_app';"
        );
        // Exit-Code != 0 ist ok, falls die Rolle aus einem vorherigen Testlauf schon existiert
        if (result.getExitCode() != 0 && !result.getStderr().contains("already exists")) {
            throw new IllegalStateException("Konnte App-Rolle nicht anlegen: " + result.getStderr());
        }
    }

    @Autowired
    private GroupService groupService;

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void usersCannotSeeEachOthersGroups() {
        UUID userA = UUID.randomUUID();
        UUID userB = UUID.randomUUID();

        runAs(userA, () -> groupService.create(new CreateGroupRequest("Marc's Legs", 0)));
        runAs(userB, () -> groupService.create(new CreateGroupRequest("Anna's Push", 0)));

        List<GroupDto> seenByA = runAs(userA, () -> groupService.listAll());
        List<GroupDto> seenByB = runAs(userB, () -> groupService.listAll());

        assertThat(seenByA).hasSize(1);
        assertThat(seenByA.get(0).name()).isEqualTo("Marc's Legs");

        assertThat(seenByB).hasSize(1);
        assertThat(seenByB.get(0).name()).isEqualTo("Anna's Push");
    }

    @Test
    void userCannotDeleteAnotherUsersGroup() {
        UUID userA = UUID.randomUUID();
        UUID userB = UUID.randomUUID();

        GroupDto groupOfA = runAs(userA, () -> groupService.create(new CreateGroupRequest("Marc's Legs", 0)));

        org.junit.jupiter.api.Assertions.assertThrows(
            jakarta.persistence.EntityNotFoundException.class,
            () -> runAs(userB, () -> {
                groupService.delete(groupOfA.id());
                return null;
            })
        );

        List<GroupDto> seenByA = runAs(userA, () -> groupService.listAll());
        assertThat(seenByA).hasSize(1);
    }

    private <T> T runAs(UUID userId, Supplier<T> action) {
        Jwt jwt = Jwt.withTokenValue("test-token")
            .header("alg", "none")
            .claim("sub", userId.toString())
            .issuedAt(Instant.now())
            .expiresAt(Instant.now().plusSeconds(60))
            .build();

        JwtAuthenticationToken authentication = new JwtAuthenticationToken(jwt);
        SecurityContextHolder.getContext().setAuthentication(authentication);

        try {
            return action.get();
        } finally {
            SecurityContextHolder.clearContext();
        }
    }
}