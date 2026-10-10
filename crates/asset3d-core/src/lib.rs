//! 3D 资产转换核心（可复用模块）。
//!
//! 阶段规划：
//!   1. assimp 导入 + 元数据提取（当前）
//!   2. 导出 glTF/GLB
//!   3. 贴图槽位表（PBR 同目录同名贴图匹配）
//!
//! 交付形态：`lib.rs`（任何 Rust 应用可依赖）+ `asset3d-cli`（任何语言可调用）。

use russimp_ng::scene::{PostProcess, Scene};
use serde::Serialize;

/// 统一的 3D 资产元数据。
///
/// 后续会引入 schema 版本号与更多字段（材质列表 / 贴图槽位 / 轴向等），
/// 旧字段保持兼容。
#[derive(Debug, Clone, Serialize)]
pub struct ModelMeta {
    pub mesh_count: usize,
    pub vertex_count: usize,
    pub triangle_count: usize,
    pub material_count: usize,
    pub animation_count: usize,
    pub bounds_min: [f32; 3],
    pub bounds_max: [f32; 3],
}

/// 导入 3D 文件并提取元数据。
///
/// 统一后处理：三角化 + 合并重复顶点 + 补法线/UV，保证下游拿到规整数据。
pub fn import_meta(path: &str) -> Result<ModelMeta, String> {
    let flags = vec![
        PostProcess::Triangulate,
        PostProcess::JoinIdenticalVertices,
        PostProcess::GenerateNormals,
        PostProcess::GenerateUVCoords,
        PostProcess::SortByPrimitiveType,
    ];
    let scene = Scene::from_file(path, flags).map_err(|e| e.to_string())?;

    let mut vertex_count = 0usize;
    let mut triangle_count = 0usize;
    let mut min = [f32::MAX; 3];
    let mut max = [f32::MIN; 3];

    for mesh in &scene.meshes {
        vertex_count += mesh.vertices.len();
        for v in &mesh.vertices {
            if v.x < min[0] {
                min[0] = v.x;
            }
            if v.y < min[1] {
                min[1] = v.y;
            }
            if v.z < min[2] {
                min[2] = v.z;
            }
            if v.x > max[0] {
                max[0] = v.x;
            }
            if v.y > max[1] {
                max[1] = v.y;
            }
            if v.z > max[2] {
                max[2] = v.z;
            }
        }
        // 三角化后每个 face 是三角形：索引数 / 3 = 三角形数
        triangle_count += mesh.faces.iter().map(|f| f.0.len() / 3).sum::<usize>();
    }

    if scene.meshes.is_empty() {
        min = [0.0; 3];
        max = [0.0; 3];
    }

    Ok(ModelMeta {
        mesh_count: scene.meshes.len(),
        vertex_count,
        triangle_count,
        material_count: scene.materials.len(),
        animation_count: scene.animations.len(),
        bounds_min: min,
        bounds_max: max,
    })
}
