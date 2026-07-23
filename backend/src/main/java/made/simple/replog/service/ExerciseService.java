package made.simple.replog.service;

import made.simple.replog.dto.CreateExerciseRequest;
import made.simple.replog.dto.EntryDto;
import made.simple.replog.dto.ExerciseDto;
import made.simple.replog.dto.ReorderExerciseRequest;
import made.simple.replog.model.Entry;
import made.simple.replog.model.Exercise;
import made.simple.replog.model.Group;
import made.simple.replog.repository.ExerciseRepository;
import made.simple.replog.repository.GroupRepository;
import made.simple.replog.security.CurrentUserProvider;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Service
public class ExerciseService {

    private final ExerciseRepository exerciseRepository;
    private final GroupRepository groupRepository;
    private final CurrentUserProvider currentUserProvider;

    public ExerciseService(ExerciseRepository exerciseRepository, GroupRepository groupRepository,
            CurrentUserProvider currentUserProvider) {
        this.exerciseRepository = exerciseRepository;
        this.groupRepository = groupRepository;
        this.currentUserProvider = currentUserProvider;
    }

    @Transactional
    public ExerciseDto create(CreateExerciseRequest request) {
        Exercise exercise = new Exercise();
        exercise.setUserId(currentUserProvider.getCurrentUserId());
        exercise.setName(request.name());
        exercise.setOrder(request.order());

        if (request.groupId() != null) {
            Group group = groupRepository.findById(request.groupId())
                    .orElseThrow(() -> new EntityNotFoundException("Group nicht gefunden: " + request.groupId()));
            exercise.setGroup(group);
        }

        return toDto(exerciseRepository.save(exercise));
    }

    @Transactional(readOnly = true)
    public List<ExerciseDto> listUngrouped() {
        return exerciseRepository.findByGroupIsNull().stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional
    public void delete(UUID id) {
        if (!exerciseRepository.existsById(id)) {
            throw new EntityNotFoundException("Exercise nicht gefunden: " + id);
        }
        exerciseRepository.deleteById(id);
    }

    @Transactional
    public void reorder(ReorderExerciseRequest request) {
        Exercise exercise = exerciseRepository.findById(request.exerciseId())
                .orElseThrow(() -> new EntityNotFoundException("Exercise nicht gefunden: " + request.exerciseId()));

        UUID oldGroupId = exercise.getGroup() != null ? exercise.getGroup().getId() : null;
        UUID newGroupId = request.targetGroupId();
        int oldOrder = exercise.getOrder();
        int newOrder = request.newOrder();

        boolean sameGroup = Objects.equals(oldGroupId, newGroupId);

        if (sameGroup) {
            if (oldOrder == newOrder) {
                return;
            }
            if (newOrder > oldOrder) {
                shiftDown(oldGroupId, oldOrder, newOrder);
            } else {
                shiftUp(oldGroupId, oldOrder, newOrder);
            }
        } else {
            closeGap(oldGroupId, oldOrder);
            makeRoom(newGroupId, newOrder);

            Group newGroup = null;
            if (newGroupId != null) {
                newGroup = groupRepository.findById(newGroupId)
                        .orElseThrow(() -> new EntityNotFoundException("Group nicht gefunden: " + newGroupId));
            }
            exercise.setGroup(newGroup);
        }

        exercise.setOrder(newOrder);
        exerciseRepository.save(exercise);
    }

    private void shiftDown(UUID groupId, int oldOrder, int newOrder) {
        if (groupId != null) {
            exerciseRepository.shiftDownInGroup(groupId, oldOrder, newOrder);
        } else {
            exerciseRepository.shiftDownInUngrouped(oldOrder, newOrder);
        }
    }

    private void shiftUp(UUID groupId, int oldOrder, int newOrder) {
        if (groupId != null) {
            exerciseRepository.shiftUpInGroup(groupId, oldOrder, newOrder);
        } else {
            exerciseRepository.shiftUpInUngrouped(oldOrder, newOrder);
        }
    }

    private void closeGap(UUID groupId, int oldOrder) {
        if (groupId != null) {
            exerciseRepository.closeGapInGroup(groupId, oldOrder);
        } else {
            exerciseRepository.closeGapInUngrouped(oldOrder);
        }
    }

    private void makeRoom(UUID groupId, int newOrder) {
        if (groupId != null) {
            exerciseRepository.makeRoomInGroup(groupId, newOrder);
        } else {
            exerciseRepository.makeRoomInUngrouped(newOrder);
        }
    }

    private ExerciseDto toDto(Exercise exercise) {
        List<EntryDto> entryDtos = exercise.getEntries().stream()
                .map(e -> new EntryDto(e.getId(), e.getDate(), e.getWeight(), e.getReps(), e.getNote()))
                .toList();
        UUID groupId = exercise.getGroup() != null ? exercise.getGroup().getId() : null;
        return new ExerciseDto(exercise.getId(), exercise.getName(), exercise.getOrder(), entryDtos, groupId);
    }
}