use serde::{Deserialize, Serialize};

/// 一个独立的资源库（对应一个 NAS 路径）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Library {
    pub id: String,
    pub name: String,
    pub path: String,
    /// 限制搜索的文件夹（相对库根，空 = 扫描全部）
    #[serde(default)]
    pub include_dirs: Vec<String>,
    /// 排除的文件夹
    #[serde(default)]
    pub exclude_dirs: Vec<String>,
    /// 美术设定文件夹（绝对路径）
    #[serde(default)]
    pub art_folder: String,
    /// 工具文件夹（绝对路径）
    #[serde(default)]
    pub tools_folder: String,
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

/// 全局共享的匹配规则（分类 / 预览格式 / 预览图后缀），不随库变。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchRules {
    #[serde(default = "default_preview_suffixes")]
    pub preview_suffixes: Vec<String>,
    #[serde(default = "default_category_rules")]
    pub category_rules: Vec<CategoryRule>,
    #[serde(default = "default_format_families")]
    pub format_families: Vec<FormatFamily>,
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
        }
    }
}

/// 应用配置（本地）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    #[serde(default)]
    pub libraries: Vec<Library>,
    #[serde(default)]
    pub active_library_id: Option<String>,
    #[serde(default)]
    pub match_rules: MatchRules,
    /// 缩略图缓存位置（空 = 用默认应用数据目录）
    #[serde(default)]
    pub cache_dir: String,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            libraries: vec![],
            active_library_id: None,
            match_rules: MatchRules::default(),
            cache_dir: String::new(),
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
