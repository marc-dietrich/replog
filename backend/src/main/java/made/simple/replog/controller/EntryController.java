package made.simple.replog.controller;

import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import made.simple.replog.dto.CreateEntryRequest;
import made.simple.replog.dto.EntryDto;
import made.simple.replog.dto.UpdateEntryRequest;
import made.simple.replog.service.EntryService;

@RestController
@RequestMapping("/api/entries")
public class EntryController {

    private final EntryService entryService;

    public EntryController(EntryService entryService) {
        this.entryService = entryService;
    }

    @PostMapping
    public EntryDto create(@RequestBody CreateEntryRequest request) {
        return entryService.create(request);
    }

    @PutMapping("/{id}")
    public EntryDto update(@PathVariable UUID id, @RequestBody UpdateEntryRequest request) {
        return entryService.update(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        entryService.delete(id);
        return ResponseEntity.noContent().build();
    }

}
