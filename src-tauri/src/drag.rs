//! Windows 文件拖出（最小实现，仅 CF_HDROP）。
//!
//! 直接用原始文件路径构造 DROPFILES，不经过 Shell 项解析，
//! 因此对映射盘 / UNC 等网络路径也可靠。
//! （`drag` crate 的 `SHCreateShellItemArrayFromIDLists` 在这些路径上会返回失败。）

use std::ffi::c_void;
use std::os::windows::ffi::OsStrExt;
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Once;

use windows::{
    core::*,
    Win32::{
        Foundation::*,
        System::Com::*,
        System::Memory::*,
        System::Ole::*,
        System::SystemServices::*,
        UI::Shell::DROPFILES,
    },
};

static OLE_INIT: Once = Once::new();

fn init_ole() {
    OLE_INIT.call_once(|| unsafe {
        let _ = OleInitialize(None);
    });
}

#[implement(IDataObject)]
struct FileDataObject {
    files: Vec<PathBuf>,
}

impl FileDataObject {
    /// 构造 CF_HDROP 的 DROPFILES 结构（UTF-16 路径，双 null 结尾）。
    fn drop_hglobal(&self) -> Result<HGLOBAL> {
        let mut buf: Vec<u16> = Vec::new();
        for p in &self.files {
            buf.extend(p.as_os_str().encode_wide());
            buf.push(0);
        }
        buf.push(0);

        let size = std::mem::size_of::<DROPFILES>() + buf.len() * 2;
        let handle = unsafe { GlobalAlloc(GMEM_FIXED, size)? };
        let ptr = unsafe { GlobalLock(handle) };
        unsafe {
            let header = ptr as *mut DROPFILES;
            (*header).pFiles = std::mem::size_of::<DROPFILES>() as u32;
            (*header).fWide = BOOL(1);
            std::ptr::copy(
                buf.as_ptr() as *const c_void,
                ptr.add(std::mem::size_of::<DROPFILES>()),
                buf.len() * 2,
            );
            let _ = GlobalUnlock(handle);
        }
        Ok(handle)
    }
}

#[allow(non_snake_case)]
impl IDataObject_Impl for FileDataObject {
    fn GetData(&self, pformatetc: *const FORMATETC) -> Result<STGMEDIUM> {
        let fmt = unsafe { (*pformatetc).cfFormat };
        if fmt == CF_HDROP.0 {
            let h = self.drop_hglobal()?;
            Ok(STGMEDIUM {
                tymed: TYMED_HGLOBAL.0 as u32,
                u: STGMEDIUM_0 { hGlobal: h },
                pUnkForRelease: std::mem::ManuallyDrop::new(None),
            })
        } else {
            Err(DV_E_FORMATETC.into())
        }
    }

    fn GetDataHere(&self, _pformatetc: *const FORMATETC, _pmedium: *mut STGMEDIUM) -> Result<()> {
        Err(DV_E_FORMATETC.into())
    }

    fn QueryGetData(&self, pformatetc: *const FORMATETC) -> HRESULT {
        let fmt = unsafe { (*pformatetc).cfFormat };
        if fmt == CF_HDROP.0 {
            S_OK
        } else {
            DV_E_FORMATETC
        }
    }

    fn GetCanonicalFormatEtc(
        &self,
        _pformatectin: *const FORMATETC,
        pformatetcout: *mut FORMATETC,
    ) -> HRESULT {
        unsafe { (*pformatetcout).ptd = std::ptr::null_mut() };
        E_NOTIMPL
    }

    fn SetData(&self, _pformatetc: *const FORMATETC, _pmedium: *const STGMEDIUM, _frelease: BOOL) -> Result<()> {
        Err(E_NOTIMPL.into())
    }

    fn EnumFormatEtc(&self, _dwdirection: u32) -> Result<IEnumFORMATETC> {
        let formats = vec![FORMATETC {
            cfFormat: CF_HDROP.0,
            ptd: std::ptr::null_mut(),
            dwAspect: DVASPECT_CONTENT.0,
            lindex: -1,
            tymed: TYMED_HGLOBAL.0 as u32,
        }];
        Ok(FormatEnum::new(formats).into())
    }

    fn DAdvise(&self, _pformatetc: *const FORMATETC, _advf: u32, _padvsink: Option<&IAdviseSink>) -> Result<u32> {
        Err(OLE_E_ADVISENOTSUPPORTED.into())
    }

    fn DUnadvise(&self, _dwconnection: u32) -> Result<()> {
        Err(OLE_E_ADVISENOTSUPPORTED.into())
    }

    fn EnumDAdvise(&self) -> Result<IEnumSTATDATA> {
        Err(OLE_E_ADVISENOTSUPPORTED.into())
    }
}

#[implement(IDropSource)]
struct FileDropSource;

#[allow(non_snake_case)]
impl IDropSource_Impl for FileDropSource {
    fn QueryContinueDrag(&self, fescapepressed: BOOL, grfkeystate: MODIFIERKEYS_FLAGS) -> HRESULT {
        if fescapepressed.as_bool() {
            DRAGDROP_S_CANCEL
        } else if (grfkeystate & MK_LBUTTON) == MODIFIERKEYS_FLAGS(0) {
            DRAGDROP_S_DROP
        } else {
            S_OK
        }
    }

    fn GiveFeedback(&self, _dweffect: DROPEFFECT) -> HRESULT {
        DRAGDROP_S_USEDEFAULTCURSORS
    }
}

#[implement(IEnumFORMATETC)]
struct FormatEnum {
    formats: Vec<FORMATETC>,
    cursor: AtomicUsize,
}

impl FormatEnum {
    fn new(formats: Vec<FORMATETC>) -> Self {
        Self {
            formats,
            cursor: AtomicUsize::new(0),
        }
    }
}

#[allow(non_snake_case)]
impl IEnumFORMATETC_Impl for FormatEnum {
    fn Next(&self, celt: u32, rgelt: *mut FORMATETC, pceltfetched: *mut u32) -> Result<()> {
        let mut fetched = 0u32;
        for i in 0..celt as usize {
            let idx = self.cursor.load(Ordering::SeqCst);
            if idx >= self.formats.len() {
                break;
            }
            unsafe {
                *rgelt.add(i) = self.formats[idx];
            }
            self.cursor.store(idx + 1, Ordering::SeqCst);
            fetched += 1;
        }
        if !pceltfetched.is_null() {
            unsafe { *pceltfetched = fetched };
        }
        if fetched == celt {
            Ok(())
        } else {
            Err(S_FALSE.into())
        }
    }

    fn Skip(&self, celt: u32) -> Result<()> {
        let idx = self.cursor.load(Ordering::SeqCst);
        let new = idx.saturating_add(celt as usize);
        if new <= self.formats.len() {
            self.cursor.store(new, Ordering::SeqCst);
            Ok(())
        } else {
            Err(S_FALSE.into())
        }
    }

    fn Reset(&self) -> Result<()> {
        self.cursor.store(0, Ordering::SeqCst);
        Ok(())
    }

    fn Clone(&self) -> Result<IEnumFORMATETC> {
        let clone = FormatEnum::new(self.formats.clone());
        clone
            .cursor
            .store(self.cursor.load(Ordering::SeqCst), Ordering::SeqCst);
        Ok(clone.into())
    }
}

/// 发起文件拖出（阻塞直到拖拽结束）。必须在主线程调用。
pub fn start_drag(paths: Vec<PathBuf>) -> std::result::Result<(), String> {
    init_ole();
    let data_object: IDataObject = FileDataObject { files: paths }.into();
    let drop_source: IDropSource = FileDropSource.into();
    let mut effect = DROPEFFECT::default();
    unsafe {
        let res = DoDragDrop(&data_object, &drop_source, DROPEFFECT_COPY, &mut effect);
        if res == DRAGDROP_S_DROP || res == DRAGDROP_S_CANCEL {
            Ok(())
        } else {
            Err(format!("拖拽失败 (HRESULT {:?})", res))
        }
    }
}
