@echo off
echo Verificando Docker...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Docker nao encontrado!
    echo Por favor, instale o Docker Desktop para Windows:
    echo https://www.docker.com/products/docker-desktop/
    echo.
    echo Apos instalar, reinicie o computador e tente novamente.
    pause
    exit /b
)

echo.
echo Parando containers antigos...
docker compose down

echo.
echo Iniciando aplicacao (pode demorar alguns minutos na primeira vez)...
docker compose up -d --build

if %errorlevel% neq 0 (
    echo.
    echo [AVISO] 'docker compose' falhou. Tentando 'docker-compose' (versao antiga)...
    docker-compose up -d --build
)

if %errorlevel% equ 0 (
    echo.
    echo ========================================================
    echo             APLICACAO INICIADA COM SUCESSO
    echo ========================================================
    echo.
    echo Dashboard:     http://localhost:3001
    echo Backend API:   http://localhost:3000
    echo Evolution API: http://localhost:8080
    echo.
    echo Para parar a aplicacao, execute: docker compose down
    echo ========================================================
) else (
    echo.
    echo [ERRO] Falha ao iniciar a aplicacao. Verifique se o Docker Desktop esta rodando.
)

pause
