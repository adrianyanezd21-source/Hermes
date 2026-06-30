// Recomendaciones para sacar el máximo partido a Hermes.
//
// Origen: el vídeo "This OpenSource Repo will 10X Your Hermes Agent"
// (canal de YouTube de Jack Roberts, @Itssssss_Jack), que presenta el
// Hermes Control Interface, más mejoras adicionales basadas en la
// documentación oficial de Hermes (Nous Research).

export const recommendations = {
  channel: {
    title: 'This OpenSource Repo will 10X Your Hermes Agent',
    author: 'Jack Roberts',
    handle: '@Itssssss_Jack',
    url: 'https://www.youtube.com/watch?v=yOZVYw9FIWc',
  },
  groups: [
    {
      id: 'panel',
      title: 'Controla Hermes desde un panel web',
      from: 'channel',
      items: [
        'Usa un dashboard web auto-alojado (como este panel) para gestionar agentes, chat, gateway, skills y cron sin tocar la terminal.',
        'Protege siempre el panel detrás de un password gate y, en producción, ponlo tras nginx + HTTPS (Cloudflare Tunnel funciona muy bien).',
        'Aprovecha la vista de "Office/Swarm" para monitorizar varios agentes a la vez con un tablero kanban de tareas.',
        'Instálalo como PWA en el móvil para controlar tu agente desde cualquier sitio.',
      ],
    },
    {
      id: 'skills',
      title: 'Skills: enseña procedimientos reutilizables',
      from: 'channel',
      items: [
        'Crea skills para tareas repetitivas (resumir YouTube, extraer PDFs, revisar código). Hermes las carga solo cuando las necesita (progressive disclosure), ahorrando tokens.',
        'Usa el estándar abierto agentskills.io para compartir e instalar skills de la comunidad.',
        'Mantén cada skill enfocada en una sola tarea bien definida; es más fiable que una skill gigante.',
      ],
    },
    {
      id: 'cron',
      title: 'Automatiza con tareas programadas (Cron)',
      from: 'channel',
      items: [
        'Programa trabajos en lenguaje natural ("cada día a las 8:00") o con expresiones cron.',
        'Haz que un cron adjunte una skill y entregue el resultado directamente a Telegram/Discord/Slack.',
        'Ejemplo potente: resumen diario de noticias de tu sector entregado por mensajería antes de empezar a trabajar.',
      ],
    },
    {
      id: 'mcp',
      title: 'Conecta herramientas externas con MCP',
      from: 'channel',
      items: [
        'Añade servidores MCP (GitHub, bases de datos, sistemas de ficheros, Composio) para dar superpoderes a Hermes sin escribir tools nativas.',
        'Usa el filtrado de tools por servidor para exponer solo lo que el agente necesita y reducir ruido en el contexto.',
      ],
    },
    {
      id: 'gateway',
      title: 'Gateway multi-plataforma 24/7',
      from: 'channel',
      items: [
        'Ejecuta el gateway como servicio (systemd) para que Hermes esté disponible en Discord/Telegram/Slack incluso con tu portátil apagado.',
        'Define un agente por caso de uso (investigación, redes, soporte) con su propio perfil y personalidad.',
      ],
    },
    {
      id: 'memory',
      title: 'Memoria persistente y contexto',
      from: 'extra',
      items: [
        'Cura MEMORY.md y USER.md: la memoria está acotada a propósito; menos pero relevante rinde mejor que mucho ruido.',
        'Coloca un archivo de contexto del proyecto (.hermes.md / AGENTS.md / SOUL.md) en cada repo para fijar cómo debe comportarse el agente.',
        'Usa referencias de contexto con @ (@archivo, @carpeta, @git-diff, @url) para inyectar información puntual sin ensuciar la memoria.',
        'Considera un proveedor de memoria externo (Mem0, Supermemory, Honcho...) si necesitas modelado de usuario entre sesiones.',
      ],
    },
    {
      id: 'reliability',
      title: 'Fiabilidad y coste (proveedores)',
      from: 'extra',
      items: [
        'Configura fallback providers: si tu modelo principal falla, Hermes conmuta automáticamente a uno de respaldo.',
        'Usa credential pools para repartir llamadas entre varias API keys y rotar al alcanzar rate limits.',
        'Activa el provider routing para optimizar por coste, velocidad o calidad según la tarea.',
        'El prompt caching (Claude) está siempre activo: estructura los prompts para reutilizar el prefijo y ahorrar tokens.',
      ],
    },
    {
      id: 'scale',
      title: 'Escala con subagentes y código',
      from: 'extra',
      items: [
        'Delega tareas a subagentes (delegate_task) con contexto y herramientas aisladas para trabajar en paralelo.',
        'Usa execute_code para que el agente escriba Python que llame a sus propias tools y colapse flujos de varios pasos en un solo turno.',
        'Para evaluaciones o datos de entrenamiento, usa el batch processing sobre cientos de prompts en paralelo.',
      ],
    },
    {
      id: 'safety',
      title: 'Seguridad y red de seguridad',
      from: 'extra',
      items: [
        'Apóyate en los checkpoints automáticos: Hermes snapshotea el directorio antes de editar ficheros; usa /rollback si algo sale mal.',
        'Usa event hooks (gateway/plugin) para logging, alertas, métricas y guardrails que intercepten tools peligrosas.',
        'Limita cada gateway a los canales necesarios y aplica control de acceso por perfil en el panel.',
      ],
    },
    {
      id: 'observability',
      title: 'Observabilidad: mira tus tokens',
      from: 'extra',
      items: [
        'Revisa el panel de uso a diario: tendencias de tokens, coste por modelo y proyección mensual con alerta de presupuesto.',
        'Identifica qué agente/skill consume más y mueve tareas baratas a modelos más económicos (p. ej. DeepSeek) reservando los caros para lo difícil.',
      ],
    },
  ],
};

export default recommendations;
