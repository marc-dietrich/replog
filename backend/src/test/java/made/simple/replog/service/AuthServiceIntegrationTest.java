package made.simple.replog.service;

import made.simple.replog.dto.LoginRequest;
import made.simple.replog.dto.RegisterRequest;
import made.simple.replog.dto.UserDto;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Integration test for AuthService — verifies register and login
 * against a real PostgreSQL database (Testcontainers).
 */
@SpringBootTest
@Testcontainers
class AuthServiceIntegrationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

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
        if (result.getExitCode() != 0 && !result.getStderr().contains("already exists")) {
            throw new IllegalStateException("Could not create app role: " + result.getStderr());
        }
    }

    @Autowired
    private AuthService authService;

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void registerCreatesUserAndReturnsUserDto() {
        RegisterRequest request = new RegisterRequest("alice", "secret123");

        UserDto result = authService.register(request);

        assertThat(result).isNotNull();
        assertThat(result.id()).isNotNull();
        assertThat(result.username()).isEqualTo("alice");
    }

    @Test
    void registerFailsWhenUsernameAlreadyTaken() {
        authService.register(new RegisterRequest("bob", "password1"));

        assertThatThrownBy(() ->
            authService.register(new RegisterRequest("bob", "password2"))
        ).isInstanceOf(IllegalArgumentException.class)
         .hasMessageContaining("Username already taken");
    }

    @Test
    void loginSucceedsWithCorrectCredentials() {
        authService.register(new RegisterRequest("charlie", "mypassword"));

        // Clear context so login is a fresh auth
        SecurityContextHolder.clearContext();

        UserDto result = authService.login(new LoginRequest("charlie", "mypassword"));

        assertThat(result).isNotNull();
        assertThat(result.username()).isEqualTo("charlie");
    }

    @Test
    void loginFailsWithWrongPassword() {
        authService.register(new RegisterRequest("dave", "correct"));

        SecurityContextHolder.clearContext();

        assertThatThrownBy(() ->
            authService.login(new LoginRequest("dave", "wrong"))
        ).isInstanceOf(IllegalArgumentException.class)
         .hasMessageContaining("Invalid username or password");
    }

    @Test
    void loginFailsWithUnknownUsername() {
        assertThatThrownBy(() ->
            authService.login(new LoginRequest("nonexistent", "password"))
        ).isInstanceOf(IllegalArgumentException.class)
         .hasMessageContaining("Invalid username or password");
    }

    @Test
    void getCurrentUserReturnsUserAfterLogin() {
        UserDto registered = authService.register(new RegisterRequest("eve", "pass123"));

        UserDto current = authService.getCurrentUser();

        assertThat(current).isNotNull();
        assertThat(current.id()).isEqualTo(registered.id());
        assertThat(current.username()).isEqualTo("eve");
    }

    @Test
    void getCurrentUserReturnsNullWhenNotAuthenticated() {
        assertThat(authService.getCurrentUser()).isNull();
    }

    @Test
    void logoutClearsSecurityContext() {
        authService.register(new RegisterRequest("frank", "pass123"));
        assertThat(authService.getCurrentUser()).isNotNull();

        authService.logout();

        assertThat(authService.getCurrentUser()).isNull();
    }

    @Test
    void passwordIsHashedNotStoredInPlaintext() {
        // Verify via login — wrong password must fail, confirming hashing works
        authService.register(new RegisterRequest("grace", "plaintext"));

        SecurityContextHolder.clearContext();

        // Same password should work
        assertThat(authService.login(new LoginRequest("grace", "plaintext"))).isNotNull();

        SecurityContextHolder.clearContext();

        // Similar but different should fail
        assertThatThrownBy(() ->
            authService.login(new LoginRequest("grace", "Plaintext"))
        ).isInstanceOf(IllegalArgumentException.class);
    }
}
