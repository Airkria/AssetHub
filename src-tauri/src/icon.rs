//! 提取文件关联图标（Windows Shell），用于详情/工具视图展示 exe 图标。
//! 用 IShellItemImageFactory 拿到 HBITMAP，再转成 PNG 字节。

use std::result::Result as StdResult;

use windows::core::*;
use windows::Win32::Foundation::SIZE;
use windows::Win32::Graphics::Gdi::{
    CreateCompatibleDC, DeleteDC, DeleteObject, GetDIBits, GetObjectW, SelectObject, BITMAP,
    BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, HBITMAP, HDC, RGBQUAD,
};
use windows::Win32::UI::Shell::{
    IShellItem, IShellItemImageFactory, SHCreateItemFromParsingName, SIIGBF_ICONONLY,
};

/// 提取文件关联图标，返回 PNG 字节。`size` 为期望边长（像素）。
pub fn get_file_icon(path: &str, size: i32) -> StdResult<Vec<u8>, String> {
    let wide: Vec<u16> = path.encode_utf16().chain(std::iter::once(0)).collect();
    let shell_item: IShellItem =
        unsafe { SHCreateItemFromParsingName(PCWSTR(wide.as_ptr()), None) }
            .map_err(|e| e.to_string())?;
    let image_factory: IShellItemImageFactory =
        shell_item.cast().map_err(|e| e.to_string())?;
    let hbitmap = unsafe {
        image_factory.GetImage(
            SIZE {
                cx: size,
                cy: size,
            },
            SIIGBF_ICONONLY,
        )
    }
    .map_err(|e| e.to_string())?;

    let png = bitmap_to_png(hbitmap)?;
    unsafe {
        let _ = DeleteObject(hbitmap);
    }
    Ok(png)
}

fn bitmap_to_png(hbitmap: HBITMAP) -> StdResult<Vec<u8>, String> {
    unsafe {
        let mut bmp = BITMAP::default();
        if GetObjectW(
            hbitmap,
            std::mem::size_of::<BITMAP>() as i32,
            Some(&mut bmp as *mut BITMAP as *mut std::ffi::c_void),
        ) == 0
        {
            return Err("读取图标尺寸失败".into());
        }
        let w = bmp.bmWidth.max(1) as u32;
        let h = bmp.bmHeight.abs().max(1) as u32;

        let mut bi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: w as i32,
                biHeight: -(h as i32), // 自上而下
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0 as u32,
                ..Default::default()
            },
            bmiColors: [RGBQUAD::default(); 1],
        };
        let mut pixels = vec![0u8; (w * h * 4) as usize];

        let dc: HDC = CreateCompatibleDC(None);
        let old = SelectObject(dc, hbitmap);
        let copied = GetDIBits(
            dc,
            hbitmap,
            0,
            h,
            Some(pixels.as_mut_ptr() as *mut std::ffi::c_void),
            &mut bi,
            DIB_RGB_COLORS,
        );
        SelectObject(dc, old);
        let _ = DeleteDC(dc);
        if copied == 0 {
            return Err("读取图标像素失败".into());
        }

        // BGRA → RGBA
        for px in pixels.chunks_exact_mut(4) {
            px.swap(0, 2);
        }

        let img = image::RgbaImage::from_raw(w, h, pixels).ok_or("图标像素无效")?;
        let mut out = Vec::new();
        img.write_to(&mut std::io::Cursor::new(&mut out), image::ImageFormat::Png)
            .map_err(|e| e.to_string())?;
        Ok(out)
    }
}
