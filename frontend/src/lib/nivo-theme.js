export function createNivoTheme() {
  return {
    text: {
      fontSize: 11,
      fill: 'rgb(var(--theme-muted-foreground-rgb))',
    },
    axis: {
      ticks: {
        line: {
          stroke: 'rgb(var(--theme-border-rgb))',
        },
        text: {
          fill: 'rgb(var(--theme-muted-foreground-rgb))',
        },
      },
      legend: {
        text: {
          fill: 'rgb(var(--theme-muted-foreground-rgb))',
        },
      },
    },
    grid: {
      line: {
        stroke: 'rgb(var(--theme-border-rgb) / 0.5)',
      },
    },
    tooltip: {
      container: {
        background: 'rgba(255,255,255,0.96)',
        color: 'rgb(var(--theme-foreground-rgb))',
        border: '1px solid rgb(var(--theme-border-rgb))',
        borderRadius: '16px',
        boxShadow: '0 16px 36px rgba(18,32,65,0.1)',
      },
    },
  }
}
