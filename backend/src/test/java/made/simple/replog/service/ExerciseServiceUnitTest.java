package made.simple.replog.service;

import made.simple.replog.dto.CreateExerciseRequest;
import made.simple.replog.model.Group;
import made.simple.replog.repository.ExerciseRepository;
import made.simple.replog.repository.GroupRepository;
import made.simple.replog.security.CurrentUserProvider;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ExerciseServiceUnitTest {

    @Mock
    private ExerciseRepository exerciseRepository;

    @Mock
    private GroupRepository groupRepository;

    @Mock
    private CurrentUserProvider currentUserProvider;

    private ExerciseService exerciseService;

    @BeforeEach
    void setUp() {
        exerciseService = new ExerciseService(exerciseRepository, groupRepository, currentUserProvider);
    }

    @Test
    void create_throwsWhenGroupNotFound() {
        UUID unknownGroupId = UUID.randomUUID();
        CreateExerciseRequest request = new CreateExerciseRequest("Bankdrücken", 0, unknownGroupId);

        when(currentUserProvider.getCurrentUserId()).thenReturn(UUID.randomUUID());
        when(groupRepository.findById(unknownGroupId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> exerciseService.create(request))
            .isInstanceOf(EntityNotFoundException.class)
            .hasMessageContaining(unknownGroupId.toString());

        // Wichtig: bei einem Fehler darf nie gespeichert werden
        verify(exerciseRepository, never()).save(any());
    }

    @Test
    void create_succeedsWithoutGroup_whenGroupIdIsNull() {
        UUID currentUser = UUID.randomUUID();
        CreateExerciseRequest request = new CreateExerciseRequest("Bankdrücken", 0, null);

        when(currentUserProvider.getCurrentUserId()).thenReturn(currentUser);
        when(exerciseRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        var result = exerciseService.create(request);

        assertThat(result.name()).isEqualTo("Bankdrücken");
        assertThat(result.groupId()).isNull();
        // groupRepository darf gar nicht erst angefragt werden, wenn keine groupId übergeben wurde
        verify(groupRepository, never()).findById(any());
    }

    @Test
    void create_assignsGroup_whenGroupExists() {
        UUID currentUser = UUID.randomUUID();
        UUID groupId = UUID.randomUUID();
        Group group = new Group();
        group.setId(groupId);

        CreateExerciseRequest request = new CreateExerciseRequest("Beinpresse", 0, groupId);

        when(currentUserProvider.getCurrentUserId()).thenReturn(currentUser);
        when(groupRepository.findById(groupId)).thenReturn(Optional.of(group));
        when(exerciseRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        var result = exerciseService.create(request);

        assertThat(result.groupId()).isEqualTo(groupId);
    }
}