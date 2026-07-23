package made.simple.replog.controller;

import made.simple.replog.dto.CreateGroupRequest;
import made.simple.replog.dto.GroupDto;
import made.simple.replog.dto.ReorderGroupsRequest;
import made.simple.replog.service.GroupService;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;

@RestController
@RequestMapping("/api/groups")
public class GroupController {

    private final GroupService groupService;

    public GroupController(GroupService groupService) {
        this.groupService = groupService;
    }

    @GetMapping("/all")
    public List<GroupDto> listFull() {
        return groupService.listAll();
    }

    @PostMapping
    public GroupDto create(@RequestBody CreateGroupRequest request) {
        return groupService.create(request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable java.util.UUID id) {
        groupService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/reorder")
    public ResponseEntity<Void> reorder(@RequestBody ReorderGroupsRequest request) {
        groupService.reorder(request);
        return ResponseEntity.noContent().build();
    }
}