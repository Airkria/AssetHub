// 骨架阶段的假数据，后续替换为真实扫描/元数据

export interface InspirationItem {
  id: string
  title: string
  tags: string[]
  gradient: string
}

export interface AssetItem {
  id: string
  name: string
  type: string
  format: string
  tags: string[]
  gradient: string
}

export interface ToolItem {
  id: string
  name: string
  purpose: string
  officialUrl: string
  tutorialUrl: string
  tag: string
}

export interface TutorialItem {
  id: string
  title: string
  platform: string
  progress: number
  gradient: string
}

export interface OutputItem {
  id: string
  project: string
  versions: { v: string; date: string; note: string }[]
  status: string
  gradient: string
}

export const inspirations: InspirationItem[] = [
  { id: "i1", title: "赛博都市夜景", tags: ["科幻", "场景", "冷色"], gradient: "from-indigo-500 to-purple-600" },
  { id: "i2", title: "末日废墟街道", tags: ["末日废墟", "场景", "压抑"], gradient: "from-amber-600 to-zinc-700" },
  { id: "i3", title: "日式庭院", tags: ["日式", "场景", "明快"], gradient: "from-emerald-500 to-teal-600" },
  { id: "i4", title: "国风山水", tags: ["国风", "场景", "暖色"], gradient: "from-rose-500 to-orange-400" },
  { id: "i5", title: "风格化角色", tags: ["风格化", "角色"], gradient: "from-fuchsia-500 to-pink-500" },
  { id: "i6", title: "中世纪城堡", tags: ["中世纪", "场景"], gradient: "from-stone-500 to-amber-700" },
  { id: "i7", title: "海底世界", tags: ["海底", "场景", "冷色"], gradient: "from-cyan-500 to-blue-600" },
  { id: "i8", title: "机甲概念", tags: ["科幻", "角色"], gradient: "from-slate-500 to-indigo-700" },
]

export const assets: AssetItem[] = [
  { id: "a1", name: "SciFi_Floor_01", type: "贴图", format: "TGA", tags: ["科幻", "PBR"], gradient: "from-slate-600 to-slate-800" },
  { id: "a2", name: "Rock_Cliff_03", type: "模型", format: "FBX", tags: ["山石", "扫描"], gradient: "from-stone-400 to-stone-600" },
  { id: "a3", name: "Fire_Explosion", type: "特效", format: "unitypackage", tags: ["火焰", "Unity"], gradient: "from-orange-500 to-red-600" },
  { id: "a4", name: "Niagara_Spark", type: "特效", format: "uasset", tags: ["粒子", "UE"], gradient: "from-yellow-400 to-orange-500" },
  { id: "a5", name: "PBR_Metal_Copper", type: "材质", format: "sbsar", tags: ["金属", "PBR"], gradient: "from-amber-600 to-orange-700" },
  { id: "a6", name: "ToonShader_Outline", type: "Shader", format: "shader", tags: ["卡通", "描边"], gradient: "from-purple-500 to-violet-700" },
  { id: "a7", name: "Prop_Barrel_01", type: "道具", format: "FBX", tags: ["道具", "PBR"], gradient: "from-zinc-500 to-zinc-700" },
  { id: "a8", name: "Character_Walk", type: "动作", format: "FBX", tags: ["角色", "动画"], gradient: "from-sky-500 to-blue-700" },
]

export const tools: ToolItem[] = [
  { id: "t1", name: "Found", purpose: "3D 资产预览与管理", officialUrl: "https://found.app", tutorialUrl: "", tag: "DAM" },
  { id: "t2", name: "PureRef", purpose: "参考图排版工具", officialUrl: "https://pureref.com", tutorialUrl: "", tag: "参考" },
  { id: "t3", name: "Quixel Bridge", purpose: "Megascans 资产下载", officialUrl: "https://quixel.com/bridge", tutorialUrl: "", tag: "资产" },
  { id: "t4", name: "Substance Designer", purpose: "程序化材质制作", officialUrl: "https://www.adobe.com/products/substance3d-designer.html", tutorialUrl: "", tag: "材质" },
  { id: "t5", name: "Houdini", purpose: "程序化建模与特效", officialUrl: "https://www.sidefx.com", tutorialUrl: "", tag: "程序化" },
  { id: "t6", name: "HandBrake", purpose: "视频转码压缩", officialUrl: "https://handbrake.fr", tutorialUrl: "", tag: "视频" },
]

export const tutorials: TutorialItem[] = [
  { id: "u1", title: "Niagara 入门到进阶", platform: "B站", progress: 60, gradient: "from-blue-500 to-indigo-600" },
  { id: "u2", title: "VFX Graph 粒子特效", platform: "YouTube", progress: 30, gradient: "from-orange-500 to-red-500" },
  { id: "u3", title: "Substance 材质工作流", platform: "官网文档", progress: 100, gradient: "from-amber-500 to-orange-600" },
  { id: "u4", title: "UE5 光照与 Lumen", platform: "B站", progress: 45, gradient: "from-teal-500 to-emerald-600" },
  { id: "u5", title: "Houdini 程序化地形", platform: "YouTube", progress: 0, gradient: "from-fuchsia-500 to-purple-600" },
  { id: "u6", title: "Blender 硬表面建模", platform: "B站", progress: 80, gradient: "from-cyan-500 to-sky-600" },
]

export const outputs: OutputItem[] = [
  {
    id: "o1",
    project: "星门-角色概念",
    versions: [
      { v: "v1.0", date: "2026-09-01", note: "初版草图" },
      { v: "v1.1", date: "2026-09-15", note: "细化配色" },
      { v: "v2.0", date: "2026-10-02", note: "重构体型" },
    ],
    status: "进行中",
    gradient: "from-violet-500 to-fuchsia-600",
  },
  {
    id: "o2",
    project: "废墟场景白盒",
    versions: [{ v: "v1.0", date: "2026-08-20", note: "白盒布局" }],
    status: "已归档",
    gradient: "from-stone-500 to-amber-700",
  },
  {
    id: "o3",
    project: "火焰特效测试",
    versions: [
      { v: "v1.0", date: "2026-09-28", note: "初始" },
      { v: "v1.1", date: "2026-10-05", note: "加烟雾" },
    ],
    status: "进行中",
    gradient: "from-orange-500 to-red-600",
  },
]
