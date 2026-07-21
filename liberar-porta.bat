@echo off
echo Liberando porta 3000 no Firewall do Windows (entrada TCP)...
netsh advfirewall firewall delete rule name="Projeto Paises Node" >nul 2>nul
netsh advfirewall firewall add rule name="Projeto Paises Node" dir=in action=allow protocol=TCP localport=3000
if errorlevel 1 (
  echo Falhou. Execute este arquivo como Administrador.
  pause
  exit /b 1
)
echo Porta 3000 liberada. Outras pessoas na rede/internet (com port forward) poderao acessar.
pause
