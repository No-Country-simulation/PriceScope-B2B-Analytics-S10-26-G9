// Team credit at the bottom of both sidebars (client app and backoffice).
export function SidebarCredits() {
  return (
    // -mx-2 / -mb-2 cancel SidebarFooter's p-2 so the top border spans the
    // full sidebar width and the line sits flush at the bottom.
    <p className="-mx-2 mt-2 -mb-2 border-t border-sidebar-border px-4 py-4 text-center text-xs text-muted-foreground">
      Hecho con amor - Equipo 9{" "}
      <span role="img" aria-label="corazón">
        ❤️
      </span>
    </p>
  )
}
