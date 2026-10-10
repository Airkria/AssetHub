use asset3d_core::import_meta;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        eprintln!("用法: asset3d-cli <模型文件> [--json]");
        std::process::exit(1);
    }
    let path = &args[1];
    let json = args.iter().any(|a| a == "--json");

    match import_meta(path) {
        Ok(meta) => {
            if json {
                println!("{}", serde_json::to_string_pretty(&meta).unwrap());
            } else {
                println!("文件: {path}");
                println!("  网格: {}", meta.mesh_count);
                println!("  顶点: {}", meta.vertex_count);
                println!("  三角形: {}", meta.triangle_count);
                println!("  材质: {}", meta.material_count);
                println!("  动画: {}", meta.animation_count);
                println!("  包围盒: min {:?} max {:?}", meta.bounds_min, meta.bounds_max);
            }
        }
        Err(e) => {
            eprintln!("导入失败: {e}");
            std::process::exit(1);
        }
    }
}
