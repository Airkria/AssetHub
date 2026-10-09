use std::path::Path;

use crate::models::{CategoryRule, Library};

impl Library {
    /// 判断某文件（相对库根的路径）是否在扫描范围内。
    pub fn is_included(&self, rel: &Path) -> bool {
        let rel = rel.to_string_lossy().replace('\\', "/");

        for ex in &self.exclude_dirs {
            let ex = ex.replace('\\', "/").trim().trim_matches('/').to_string();
            if !ex.is_empty() && path_matches(&rel, &ex) {
                return false;
            }
        }

        if self.include_dirs.is_empty() {
            return true;
        }
        for inc in &self.include_dirs {
            let inc = inc.replace('\\', "/").trim().trim_matches('/').to_string();
            if !inc.is_empty() && path_matches(&rel, &inc) {
                return true;
            }
        }
        false
    }
}

/// 按「目录段」逐段匹配，而非裸字符串前缀。
/// 支持 "01_Texture" 匹配 "01_Texture-贴图库"（code-中文 命名约定），
/// 且 "01" 不会误匹配 "010_Bridge"。
fn path_matches(rel: &str, pattern: &str) -> bool {
    let rel_segs: Vec<&str> = rel.split('/').filter(|s| !s.is_empty()).collect();
    let pat_segs: Vec<&str> = pattern.split('/').filter(|s| !s.is_empty()).collect();
    if pat_segs.is_empty() {
        return true;
    }
    if pat_segs.len() > rel_segs.len() {
        return false;
    }
    pat_segs
        .iter()
        .zip(rel_segs.iter())
        .all(|(p, r)| segment_matches(r, p))
}

fn segment_matches(actual: &str, pattern: &str) -> bool {
    if actual == pattern {
        return true;
    }
    match actual.split_once('-') {
        Some((code, _)) => code == pattern,
        None => false,
    }
}

/// 分类：按扩展名规则（全局），命中则用规则分类；未命中归「未分类」。
pub fn categorize_asset(ext: &str, rules: &[CategoryRule]) -> String {
    let ext = ext.trim_start_matches('.').to_lowercase();
    for rule in rules {
        if rule
            .extensions
            .iter()
            .any(|e| e.trim_start_matches('.').eq_ignore_ascii_case(&ext))
        {
            return rule.name.clone();
        }
    }
    "未分类".to_string()
}
