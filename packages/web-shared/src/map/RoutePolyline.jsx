import{Polyline}from"react-leaflet";export function RoutePolyline({geometry=[]}){return geometry.length>1?<Polyline positions={geometry} pathOptions={{color:"#16b875",weight:5}}/>:null}
