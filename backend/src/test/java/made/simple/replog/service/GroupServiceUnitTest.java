package made.simple.replog.service;

import made.simple.replog.model.Entry;
import made.simple.replog.model.Exercise;
import made.simple.replog.model.Group;
import made.simple.replog.repository.ExerciseRepository;
import made.simple.replog.repository.GroupRepository;
import made.simple.replog.security.CurrentUserProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GroupServiceUnitTest {

    @Mock
    private GroupRepository groupRepository;

    @Mock
    private ExerciseRepository exerciseRepository;

    @Mock
    private CurrentUserProvider currentUserProvider;

    private GroupService groupService;

    @BeforeEach
    void setUp() {
        groupService = new GroupService(groupRepository, exerciseRepository, currentUserProvider);
    }

    @Test
    void listAll_limitsEntries_whenEntriesLimitProvided() {
        UUID groupId = UUID.randomUUID();
        UUID exerciseId = UUID.randomUUID();

        Group group = new Group();
        group.setId(groupId);
        group.setName("Legs");
        group.setOrder(0);

        Exercise exercise = new Exercise();
        exercise.setId(exerciseId);
        exercise.setName("Squat");
        exercise.setOrder(0);
        exercise.setGroup(group);

        // 12 entries for the exercise
        var entries = new ArrayList<Entry>();
        for (int i = 0; i < 12; i++) {
            Entry e = new Entry();
            e.setId(UUID.randomUUID());
            e.setDate(LocalDate.of(2026, 7, 26).minusDays(i));
            e.setWeight(BigDecimal.valueOf(100 - i));
            e.setReps(5);
            entries.add(e);
        }
        exercise.setEntries(entries);
        group.setExercises(List.of(exercise));

        when(groupRepository.findAll()).thenReturn(List.of(group));

        var result = groupService.listAll(10);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).name()).isEqualTo("Legs");
        assertThat(result.get(0).exercises()).hasSize(1);
        assertThat(result.get(0).exercises().get(0).entries()).hasSize(10);
        // Newest first
        assertThat(result.get(0).exercises().get(0).entries().get(0).date())
                .isEqualTo(LocalDate.of(2026, 7, 26));
    }

    @Test
    void listAll_returnsAllEntries_whenEntriesLimitIsNull() {
        UUID groupId = UUID.randomUUID();
        UUID exerciseId = UUID.randomUUID();

        Group group = new Group();
        group.setId(groupId);
        group.setName("Legs");
        group.setOrder(0);

        Exercise exercise = new Exercise();
        exercise.setId(exerciseId);
        exercise.setName("Squat");
        exercise.setOrder(0);
        exercise.setGroup(group);

        var entries = new ArrayList<Entry>();
        for (int i = 0; i < 5; i++) {
            Entry e = new Entry();
            e.setId(UUID.randomUUID());
            e.setDate(LocalDate.of(2026, 7, 26).minusDays(i));
            e.setWeight(BigDecimal.valueOf(100));
            e.setReps(5);
            entries.add(e);
        }
        exercise.setEntries(entries);
        group.setExercises(List.of(exercise));

        when(groupRepository.findAll()).thenReturn(List.of(group));

        var result = groupService.listAll(null);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).exercises().get(0).entries()).hasSize(5);
    }

    @Test
    void listAll_returnsEmptyList_whenNoGroupsExist() {
        when(groupRepository.findAll()).thenReturn(List.of());

        var result = groupService.listAll(null);

        assertThat(result).isEmpty();
    }

    @Test
    void listAll_worksWithNullLimit_onUngroupedExercise() {
        UUID groupId = UUID.randomUUID();
        UUID exerciseId = UUID.randomUUID();

        Group group = new Group();
        group.setId(groupId);
        group.setName("Push");
        group.setOrder(0);

        Exercise exercise = new Exercise();
        exercise.setId(exerciseId);
        exercise.setName("Bench Press");
        exercise.setOrder(0);
        exercise.setEntries(new ArrayList<>());
        group.setExercises(List.of(exercise));

        when(groupRepository.findAll()).thenReturn(List.of(group));

        var result = groupService.listAll(5);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).exercises().get(0).entries()).isEmpty();
    }
}
