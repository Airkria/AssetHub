use serde::{Deserialize, Serialize};

/// 一个独立的资源库（对应一个 NAS 路径）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Library {
    pub id: String,
    pub name: String,
    pub path: String,
}

/// 扩展名 → 分类 的规则（#7 资产库分类）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryRule {
    pub name: String,
    /// 扩展名列表（不带点，小写）
    pub extensions: Vec<String>,
}

/// 预览格式家族（#4：决定用哪类预览器渲染）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormatFamily {
    pub key: String,
    pub label: String,
    pub extensions: Vec<String>,
}

/// 匹配规则：控制扫描范围、分类与预览格式。schema v1，字段缺省可容忍。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchRules {
    /// 限制搜索的文件夹（相对库根的子路径前缀，空 = 扫描全部）
    #[serde(default)]
    pub include_dirs: Vec<String>,
    /// 排除的文件夹（相对库根的前缀）
    #[serde(default)]
    pub exclude_dirs: Vec<String>,
    /// 预览图后缀（包体↔预览图匹配时按顺序尝试）
    #[serde(default = "default_preview_suffixes")]
    pub preview_suffixes: Vec<String>,
    /// 扩展名 → 分类 规则（优先于目录名分类）
    #[serde(default = "default_category_rules")]
    pub category_rules: Vec<CategoryRule>,
    /// 预览格式家族
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
            include_dirs: vec![],
            exclude_dirs: vec![],
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
    /// 美术设定文件夹（相对库根，如 00_ArtSetting）
    #[serde(default)]
    pub art_folder: String,
    /// 工具文件夹（相对库根）
    #[serde(default)]
    pub tools_folder: String,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            libraries: vec![],
            active_library_id: None,
            match_rules: MatchRules::default(),
            art_folder: String::new(),
            tools_folder: String::new(),
        }
    }
}

/// 索引中的一条资产
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Asset {
    /// 相对库根的路径（唯一 id）
    pub id: String,
    /// 绝对路径
    pub path: String,
    /// 文件名（含扩展）
    pub name: String,
    /// 不含扩展的文件名
    pub stem: String,
    /// 小写扩展名（无点）
    pub ext: String,
    /// 分类（从扩展名规则或目录名提取）
    pub category: String,
    /// 相对库根的目录
    pub rel_dir: String,
    pub size: u64,
    pub mtime: u64,
    /// 是否为预览图
    pub is_preview: bool,
    /// 包体资产关联的预览图路径（可多张）
    #[serde(default)]
    pub preview_paths: Vec<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    /// 是否被用户编辑过（编辑层覆盖初始元数据）
    #[serde(default)]
    pub edited: bool,
    /// 说明（工具等板块用）
    #[serde(default)]
    pub description: String,
    /// 链接（官网/教程等）
    #[serde(default)]
    pub link: String,
}
