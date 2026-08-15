package made.simple.replog.service;

import made.simple.replog.dto.CreateExerciseRequest;
import made.simple.replog.dto.EntryDto;
import made.simple.replog.dto.ExerciseDto;
import made.simple.replog.dto.ReorderExerciseRequest;
import made.simple.replog.dto.UpdateExerciseRequest;
import made.simple.replog.model.Entry;
import made.simple.replog.model.Exercise;
import made.simple.replog.model.Group;
import made.simple.replog.repository.EntryRepository;
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
    private final EntryRepository entryRepository;
    private final GroupRepository groupRepository;
    private final CurrentUserProvider currentUserProvider;

    public ExerciseService(ExerciseRepository exerciseRepository, EntryRepository entryRepository,
            GroupRepository groupRepository,
            CurrentUserProvider currentUserProvider) {
        this.exerciseRepository = exerciseRepository;
        this.entryRepository = entryRepository;
        this.groupRepository = groupRepository;
        this.currentUserProvider = currentUserProvider;
    }

    /**
     * Idempotent create (Q2): a retried create with an already-known client
     * UUID returns the existing entity.
     */
    @Transactional
    public ExerciseDto create(CreateExerciseRequest request) {
        if (request.id() == null) {
            throw new IllegalArgumentException("id (client UUID) is required");
        }
        var existing = exerciseRepository.findById(request.id());
        if (existing.isPresent()) {
            return toDto(existing.get());
        }

        Exercise exercise = new Exercise();
        exercise.setId(request.id());
        exercise.setUserId(currentUserProvider.getCurrentUserId());
        exercise.setName(request.name());
        exercise.setOrder(request.order());
        exercise.setCreatedAt(request.createdAt());
        exercise.setUpdatedAt(request.updatedAt());

        if (request.groupId() != null) {
            Group group = groupRepository.findById(request.groupId())
                    .orElseThrow(() -> new EntityNotFoundException("Group nicht gefunden: " + request.groupId()));
            exercise.setGroup(group);
        }

        return toDto(exerciseRepository.save(exercise));
    }

    /** Full payload replacement (F2) — also the target of offline reorders (Q4). */
    @Transactional
    public ExerciseDto update(UUID id, UpdateExerciseRequest request) {
        Exercise exercise = exerciseRepository.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("Exercise nicht gefunden: " + id));

        exercise.setName(request.name());
        exercise.setOrder(request.order());

        UUID newGroupId = request.groupId();
        UUID currentGroupId = exercise.getGroup() != null ? exercise.getGroup().getId() : null;
        if (!Objects.equals(newGroupId, currentGroupId)) {
            if (newGroupId != null) {
                Group group = groupRepository.findById(newGroupId)
                        .orElseThrow(() -> new EntityNotFoundException("Group nicht gefunden: " + newGroupId));
                exercise.setGroup(group);
            } else {
                exercise.setGroup(null);
            }
        }

        if (request.createdAt() != null) {
            exercise.setCreatedAt(request.createdAt());
        }
        exercise.setUpdatedAt(request.updatedAt());

        return toDto(exerciseRepository.save(exercise));
    }

    @Transactional(readOnly = true)
    public List<ExerciseDto> listUngrouped() {
        return listUngrouped(null);
    }

    @Transactional(readOnly = true)
    public List<ExerciseDto> listUngrouped(Integer entriesLimit) {
        return exerciseRepository.findByGroupIsNull().stream()
                .map(e -> toDto(e, entriesLimit))
                .toList();
    }

    /**
     * Idempotent delete (F1) with explicit entry cascade (Q5): deleting an
     * already-deleted exercise is a no-op; deleting an exercise removes all
     * of its entries server-side.
     */
    @Transactional
    public void delete(UUID id) {
        if (!exerciseRepository.existsById(id)) {
            return; // target state already reached — no-op, not an error
        }
        entryRepository.deleteByExerciseId(id);
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
        return toDto(exercise, null);
    }

    private ExerciseDto toDto(Exercise exercise, Integer entriesLimit) {
        var allEntries = exercise.getEntries().stream()
                .sorted((a, b) -> b.getDate().compareTo(a.getDate()))
                .toList();
        var limitedEntries = (entriesLimit != null && entriesLimit > 0)
                ? allEntries.stream().limit(entriesLimit).toList()
                : allEntries;

        List<EntryDto> entryDtos = limitedEntries.stream()
                .map(e -> new EntryDto(e.getId(), e.getDate(), e.getWeight(), e.getReps(), e.getNote(),
                        e.getCreatedAt(), e.getUpdatedAt()))
                .toList();
        UUID groupId = exercise.getGroup() != null ? exercise.getGroup().getId() : null;
        return new ExerciseDto(exercise.getId(), exercise.getName(), exercise.getOrder(), entryDtos, groupId,
                exercise.getCreatedAt(), exercise.getUpdatedAt());
    }
}