use serde::{Deserialize, Serialize};

/// 板块（资产管理的核心单元）：名称 + 文件夹 + 扫描过滤 + 显示方案
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoardConfig {
    pub id: String,
    pub name: String,
    /// 板块文件夹（绝对路径）
    pub folder: String,
    /// 只扫这些子目录（相对 folder，空 = 全扫）
    #[serde(default)]
    pub include_dirs: Vec<String>,
    /// 排除这些子目录（相对 folder）
    #[serde(default)]
    pub exclude_dirs: Vec<String>,
    /// "masonry" | "grid" | "drawer" | "tree" | "board"
    #[serde(default = "default_layout")]
    pub layout: String,
}

fn default_layout() -> String {
    "masonry".into()
}

/// 扩展名 → 分类 的规则
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryRule {
    pub name: String,
    pub extensions: Vec<String>,
}

/// 预览格式家族
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormatFamily {
    pub key: String,
    pub label: String,
    pub extensions: Vec<String>,
}

/// 全局共享的匹配规则（分类 / 预览格式 / 预览后缀 / 共识标签），不随板块变。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchRules {
    #[serde(default = "default_preview_suffixes")]
    pub preview_suffixes: Vec<String>,
    #[serde(default = "default_category_rules")]
    pub category_rules: Vec<CategoryRule>,
    #[serde(default = "default_format_families")]
    pub format_families: Vec<FormatFamily>,
    #[serde(default)]
    pub tag_vocabulary: Vec<String>,
}

fn default_preview_suffixes() -> Vec<String> {
    vec!["".into(), "_preview".into(), "_thumb".into(), "_预览".into()]
}

fn default_category_rules() -> Vec<CategoryRule> {
    vec![
        CategoryRule {
            name: "UnityPackage".into(),
            extensions: vec!["package".into(), "unitypackage".into()],
        },
        CategoryRule {
            name: "UE资产".into(),
            extensions: vec!["uasset".into(), "umap".into()],
        },
        CategoryRule {
            name: "模型".into(),
            extensions: vec![
                "fbx".into(), "obj".into(), "glb".into(), "gltf".into(),
                "blend".into(), "max".into(), "ma".into(), "mb".into(),
                "3ds".into(), "stl".into(),
            ],
        },
        CategoryRule {
            name: "贴图".into(),
            extensions: vec![
                "png".into(), "jpg".into(), "jpeg".into(), "tga".into(),
                "exr".into(), "hdr".into(), "dds".into(), "psd".into(),
                "webp".into(), "bmp".into(),
            ],
        },
        CategoryRule {
            name: "视频".into(),
            extensions: vec![
                "mp4".into(), "mov".into(), "avi".into(), "webm".into(),
                "mkv".into(), "gif".into(),
            ],
        },
        CategoryRule {
            name: "音频".into(),
            extensions: vec!["mp3".into(), "wav".into(), "ogg".into(), "flac".into()],
        },
        CategoryRule {
            name: "压缩包".into(),
            extensions: vec!["zip".into(), "rar".into(), "7z".into()],
        },
    ]
}

fn default_format_families() -> Vec<FormatFamily> {
    vec![
        FormatFamily {
            key: "3d".into(),
            label: "3D".into(),
            extensions: ext(&["fbx", "obj", "glb", "gltf", "blend", "max", "ma", "mb", "3ds", "stl"]),
        },
        FormatFamily {
            key: "img".into(),
            label: "IMG".into(),
            extensions: ext(&["png", "jpg", "jpeg", "tga", "exr", "hdr", "dds", "psd", "webp", "bmp", "gif", "tif", "tiff"]),
        },
        FormatFamily {
            key: "vids".into(),
            label: "VIDS".into(),
            extensions: ext(&["mp4", "mov", "avi", "webm", "mkv", "m4v"]),
        },
        FormatFamily {
            key: "mp3".into(),
            label: "MP3".into(),
            extensions: ext(&["mp3", "wav", "ogg", "flac", "aac", "m4a"]),
        },
    ]
}

fn ext(list: &[&str]) -> Vec<String> {
    list.iter().map(|s| s.to_string()).collect()
}

impl Default for MatchRules {
    fn default() -> Self {
        Self {
            preview_suffixes: default_preview_suffixes(),
            category_rules: default_category_rules(),
            format_families: default_format_families(),
            tag_vocabulary: vec![],
        }
    }
}

/// 应用配置（本地）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    #[serde(default)]
    pub boards: Vec<BoardConfig>,
    #[serde(default)]
    pub match_rules: MatchRules,
    /// 缩略图缓存位置（空 = 用默认应用数据目录）
    #[serde(default)]
    pub cache_dir: String,
    /// 放大预览时解码的尺寸上限（像素，最长边）
    #[serde(default = "default_zoom_max_px")]
    pub zoom_max_px: u32,
}

fn default_zoom_max_px() -> u32 {
    2048
}

impl Default for Config {
    fn default() -> Self {
        Self {
            boards: vec![],
            match_rules: MatchRules::default(),
            cache_dir: String::new(),
            zoom_max_px: default_zoom_max_px(),
        }
    }
}

/// 索引中的一条资产
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Asset {
    pub id: String,
    pub path: String,
    pub name: String,
    pub stem: String,
    pub ext: String,
    pub category: String,
    pub rel_dir: String,
    pub size: u64,
    pub mtime: u64,
    pub is_preview: bool,
    #[serde(default)]
    pub preview_paths: Vec<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub edited: bool,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub link: String,
}
