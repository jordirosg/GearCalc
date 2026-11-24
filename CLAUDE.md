# gearcalc
Aplicación web HTML + JavaScript puro (sin frameworks, sin build).
Cálculo de engranajes cilíndricos de evolvente según ISO 21771 / ISO 53-1998.
El perfil de los dientes debe ser el resultante de una generacion por cremallera ISO 53-1998. Debe poder contemplar los posibles perfiles A,B,C,D de la norma
Cálculo de engranajes por pareja piñón/rueda, dando: numero de dientes, modulo, distancia entre centros. Estos valores deben poder entrarse como variables
Inicialmente se propone igualdad de espesor base entre piñon y rueda, pero este valor (ebp/ebr =1) debe poder cambiar con un control deplazable.
El canvas debe ocupar toda la pantalla y la entrada de valores debe hacerse con una pantalla tipo drawer que se muestra y oculta.
La disposicion en pantalla debe ser vertical (para su visualizacion en smartphones) con el piñon arriba y la rueda abajo


## Estructura
- index.html, css/styles.css, js/ (módulos ES: geometry.js, ui.js, charts.js)
- Gráficos con Chart.js (CDN); perfil del diente dibujado en <canvas> o SVG

## Convenciones
- Unidades en mm y grados; ángulos internos en radianes
- Interfaz en español 
- Funciones de cálculo puras y separadas de la UI, con tests en tests/
