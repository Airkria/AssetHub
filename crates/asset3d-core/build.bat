@echo off
rem asset3d-core build helper: load MSVC env (for bindgen C headers), set 64-bit libclang, then cargo build.
rem Requires VS 2022 with MSVC + LLVM x64 (libclang.dll).
call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat" || exit /b 1
set "LIBCLANG_PATH=C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Tools\Llvm\x64\bin"
cd /d "%~dp0"
cargo build %*
