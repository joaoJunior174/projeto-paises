@echo off
echo === Projeto Paises - Setup servidor local ===
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado. Instale em https://nodejs.org/
  exit /b 1
)

echo Instalando dependencias...
call npm install
if errorlevel 1 exit /b 1

echo.
echo Criando banco PostgreSQL (se necessario)...
call npm run db:create
if errorlevel 1 (
  echo.
  echo Falha ao criar o banco. Confira se o PostgreSQL esta rodando.
  echo Usuario: user ^| Senha: password ^| Banco: paises
  exit /b 1
)

echo.
echo Rodando migrations e seed...
call npm run setup
if errorlevel 1 exit /b 1

echo.
echo Pronto! Para iniciar o servidor: npm start
echo Depois abra http://localhost:3000
pause
