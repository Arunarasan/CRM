package com.arudra.crm.service;

import com.arudra.crm.dto.website.SiteContentDto.*;
import com.arudra.crm.entity.ContentBlock;
import com.arudra.crm.entity.SiteSetting;
import com.arudra.crm.repository.ContentBlockRepository;
import com.arudra.crm.repository.SiteSettingRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * CMS management + public read of site settings and page content. Two sides:
 *  - admin ({@code /api/website/settings}, {@code /api/website/content}): view + edit everything.
 *  - public ({@code /api/public/settings}, {@code /api/public/content/{page}}): flat key→value map
 *    and a page's active blocks, which the website overlays on its compiled-in defaults.
 * New keys can be created by saving them; existing ones are updated in place.
 */
@Service
public class WebsiteContentService {

    private final SiteSettingRepository settingRepo;
    private final ContentBlockRepository contentRepo;

    public WebsiteContentService(SiteSettingRepository settingRepo, ContentBlockRepository contentRepo) {
        this.settingRepo = settingRepo;
        this.contentRepo = contentRepo;
    }

    // =========================================================================================
    // Settings
    // =========================================================================================

    @Transactional(readOnly = true)
    public List<SettingDto> listSettings() {
        List<SettingDto> out = new ArrayList<>();
        for (SiteSetting s : settingRepo.findByIsDeletedFalseOrderByDisplayOrderAscIdAsc()) {
            out.add(toSettingDto(s));
        }
        return out;
    }

    /** Flat key→value map for the public site. */
    @Transactional(readOnly = true)
    public Map<String, String> publicSettings() {
        Map<String, String> map = new LinkedHashMap<>();
        for (SiteSetting s : settingRepo.findByIsDeletedFalseOrderByDisplayOrderAscIdAsc()) {
            map.put(s.getSettingKey(), s.getSettingValue());
        }
        return map;
    }

    /** Bulk upsert from the CRM settings form. Unknown keys are created (as a plain text setting). */
    @Transactional
    public List<SettingDto> saveSettings(List<SettingSave> settings) {
        if (settings == null) return listSettings();
        for (SettingSave item : settings) {
            if (item.key() == null || item.key().isBlank()) continue;
            SiteSetting s = settingRepo.findBySettingKeyAndIsDeletedFalse(item.key().trim())
                    .orElseGet(() -> {
                        SiteSetting n = new SiteSetting();
                        n.setSettingKey(item.key().trim());
                        return n;
                    });
            s.setSettingValue(item.value());
            settingRepo.save(s);
        }
        return listSettings();
    }

    private SettingDto toSettingDto(SiteSetting s) {
        return new SettingDto(s.getId(), s.getSettingKey(), s.getSettingValue(),
                s.getGroupName(), s.getLabel(), s.getInputType(), s.getDisplayOrder());
    }

    // =========================================================================================
    // Content blocks
    // =========================================================================================

    @Transactional(readOnly = true)
    public List<ContentBlockDto> listContent() {
        List<ContentBlockDto> out = new ArrayList<>();
        for (ContentBlock c : contentRepo.findByIsDeletedFalseOrderByPageAscDisplayOrderAscIdAsc()) {
            out.add(toContentDto(c));
        }
        return out;
    }

    /** Active blocks for one page, for the public site. */
    @Transactional(readOnly = true)
    public List<ContentBlockDto> publicContent(String page) {
        List<ContentBlockDto> out = new ArrayList<>();
        for (ContentBlock c : contentRepo
                .findByPageAndActiveTrueAndIsDeletedFalseOrderByDisplayOrderAscIdAsc(page)) {
            out.add(toContentDto(c));
        }
        return out;
    }

    @Transactional
    public ContentBlockDto createContent(ContentBlockDto d) {
        if (d.page() == null || d.page().isBlank() || d.sectionKey() == null || d.sectionKey().isBlank()) {
            throw new IllegalArgumentException("Page and section are required.");
        }
        contentRepo.findByPageAndSectionKeyAndIsDeletedFalse(d.page().trim(), d.sectionKey().trim())
                .ifPresent(existing -> { throw new IllegalArgumentException(
                        "A block for " + d.page() + "/" + d.sectionKey() + " already exists."); });
        ContentBlock c = new ContentBlock();
        c.setPage(d.page().trim());
        c.setSectionKey(d.sectionKey().trim());
        apply(c, d);
        return toContentDto(contentRepo.save(c));
    }

    @Transactional
    public ContentBlockDto updateContent(Long id, ContentBlockDto d) {
        ContentBlock c = load(id);
        apply(c, d);
        return toContentDto(contentRepo.save(c));
    }

    @Transactional
    public void deleteContent(Long id) {
        ContentBlock c = load(id);
        c.setIsDeleted(true);
        c.setDeletedAt(java.time.LocalDateTime.now());
        contentRepo.save(c);
    }

    @Transactional
    public ContentBlockDto toggleContent(Long id) {
        ContentBlock c = load(id);
        c.setActive(!Boolean.TRUE.equals(c.getActive()));
        return toContentDto(contentRepo.save(c));
    }

    private void apply(ContentBlock c, ContentBlockDto d) {
        c.setTitle(d.title());
        c.setSubtitle(d.subtitle());
        c.setBody(d.body());
        if (d.displayOrder() != null) c.setDisplayOrder(d.displayOrder());
        if (d.active() != null) c.setActive(d.active());
    }

    private ContentBlock load(Long id) {
        return contentRepo.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new EntityNotFoundException("Content block not found: " + id));
    }

    private ContentBlockDto toContentDto(ContentBlock c) {
        return new ContentBlockDto(c.getId(), c.getPage(), c.getSectionKey(),
                c.getTitle(), c.getSubtitle(), c.getBody(), c.getDisplayOrder(), c.getActive());
    }
}
