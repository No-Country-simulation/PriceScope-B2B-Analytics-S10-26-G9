# UX08 · Notas para el commit y el Pull Request

- Mantener la distribución conceptual del prototipo: navegación de secciones a la izquierda y tarjetas apiladas a la derecha; en móvil, navegación superior y una columna.
- Reutilizar shadcn y el layout del panel. Conservar este formato salvo necesidad funcional o responsive.
- Nombre y empresa son los únicos campos editables que admite actualmente `PATCH /api/v1/account/profile`.
- Cargo y teléfono aparecen como campos deshabilitados, sin aviso adicional en la interfaz. El contrato de la API todavía no los incluye; se aclara esta limitación en el informe y el PR.
- Cargo y teléfono no forman parte del estado, las validaciones ni del cuerpo de la petición. Se agrupan en `PendingContactFields`, que se puede retirar quitando una única referencia en `profile-form.tsx`.
- No se modificó el backend. No presentar cargo y teléfono como funcionalidad de guardado completada.
- Cambio directo de contraseña conectado a `PATCH /api/v1/account/password`. Se envían solo contraseña actual y nueva; la confirmación se valida en frontend.
- Se reutilizan el campo mostrar/ocultar y las reglas de contraseña de recuperación/alta mediante componentes y utilidades compartidos.
- Tras el éxito se descarta la sesión local sin solicitar otro refresco y se redirige al login con un aviso. La API revoca las sesiones de todos los dispositivos.
- Las pruebas no modifican credenciales de la cuenta compartida. La prueba completa requiere una cuenta de prueba propia.
- Baja lógica conectada a `DELETE /api/v1/account`, disponible solo para clientes. Requiere contraseña actual y la frase exacta `ELIMINAR MI CUENTA`; no se presenta como borrado permanente de datos.
- Zona de peligro visible para administradores con el botón deshabilitado y una explicación. El diálogo de baja no se monta para ese rol.
- El diálogo enfoca Cancelar al abrir, limpia los campos al cerrar, evita envíos duplicados y mantiene los errores visibles. Tras el éxito, el login muestra el aviso de baja.
- Pruebas de baja realizadas con API simulada. La ejecución real queda pendiente de una cuenta desechable.
- Cambio de correo sigue pendiente; la página de confirmación del nuevo correo queda fuera del alcance acordado.
- Verificaciones realizadas: TypeScript, ESLint y compilación; validaciones y cambios de sesión probados con API simulada. El guardado autenticado del perfil, el cambio real de contraseña y la baja real siguen pendientes de cuentas de prueba propias.
- El comportamiento del botón de navegación lateral en pantallas pequeñas se reportó como incidencia compartida y no se modificó en UX08.
