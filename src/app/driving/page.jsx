"use client";

import React, { useState, useEffect, useRef } from "react";
import { Wrapper } from "@googlemaps/react-wrapper";
import ThreejsOverlayView from "@ubilabs/threejs-overlay-view";
import { CatmullRomCurve3, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
// // import fetchDirections from "../src/fetchDirections";
import { getGeocode,getLatLng } from "use-places-autocomplete";
import { get } from "http";


const mapOptions = {
  mapId: process.env.NEXT_PUBLIC_MAP_ID,
  center: { lat: 43.66293, lng: -79.39314 },
  zoom: 18,
  disableDefaultUI: true,
  heading: 25,
  tilt: 60,
};

export default function Page() {
  return (
    <Wrapper apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}>
      <MyMap />
    </Wrapper>
  );
}

function MyMap() {
  const [route, setRoute] = useState();
  const ref = useRef();
  const [map, setMap] = useState();
  useEffect(() => {
    setMap(new window.google.maps.Map(ref.current, mapOptions));
  }, []);
  return (
    <>
      <div ref={ref} id="map" />
      {map && <Direction setRoute={setRoute} />}
      {map && route && <Animation route={route} map={map} />}
    </>
  );
}
function Direction({ setRoute }) {
  const [origin] = useState("27 Front St E Toronto");
  const [destination] = useState("75 Yonge Street Toronto");

  useEffect(()=>{
    fetchDirections(origin,destination,setRoute)
  },[origin,destination])

  return (
    <div className="directions">
      <h2>Directions</h2>
      <h3 className="text-bold text-yellow-500">Origin</h3>
      <p>{origin}</p>
      <h3 className="text-bold text-green-500">Destination</h3>
      <p>{destination}</p>
    </div>
  );
}
const ANIMATION_MS = 10000;
const FRONT_VECTOR = new Vector3(0, -1, 0);

function Animation({map, route}){
  const overlayRef = useRef();
  const trackRef = useRef();
  const carRef = useRef();
  useEffect(()=>{
    map.setCenter(route[Math.floor(route.length / 2)], 17);;
    if(!overlayRef.current){
      overlayRef.current = new ThreejsOverlayView(mapOptions.center);
      overlayRef.current.setMap(map);
    }
    const scene = overlayRef.current.getScene();
    const points = route.map((p) => overlayRef.current.latLngAltToVector3(p));//convert into vectors from lng and lats in order to render using threejs
    const curve = new CatmullRomCurve3(points);

    //TRACK
    if(trackRef.current){
      scene.remove(trackRef.current);
    }
    trackRef.current = createTrackFromCurve(curve);
    scene.add(trackRef.current)
    //MODEL
    loadModel().then(model =>{
      if(carRef.current){
        scene.remove(carRef.current);
      }
      carRef.current = model;
      scene.add(carRef.current)
    })

    overlayRef.current.update = () =>{
      trackRef.current.material.resolution.copy(
        overlayRef.current.getViewportSize()
      )
      if(carRef.current){
        const progress =(performance.now() % ANIMATION_MS) / ANIMATION_MS;
        curve.getPointAt(progress,carRef.current.position);
        carRef.current.quaternion.setFromUnitVectors(
          FRONT_VECTOR,
          curve.getTangentAt(progress)
        );
        carRef.current.rotateX(Math.PI / 2);
      }
      overlayRef.current.requestRedraw();
    }
    return () =>{
      scene.remove(trackRef.current);
      scene.remove(carRef.current)
    }
    
  },[route])
  return null;
}

async function loadModel(){
  const loader = new GLTFLoader();
  const object = await loader.loadAsync("/low_poly_car/scene.gltf");
  const group = object.scene;
  group.scale.setScalar(0.5);

  return group;

}

function createTrackFromCurve(curve){
  const points = curve.getSpacedPoints(curve.points.length * 10);
  const positions = points.map(point => point.toArray()).flat()
  return new Line2(
    new LineGeometry().setPositions(positions),
    new LineMaterial({ color: 0xffb783, linewidth: 8 })
  )
}


async function fetchDirections(origin,destination,setRoute) {
 const [originResults, destinationResults] = await Promise.all([
    getGeocode({address:origin}),
    getGeocode({address:destination}),
  ]);

  const [originLocation, destinationLocation] = await Promise.all([
    getLatLng(originResults[0]),
    getLatLng(destinationResults[0]),
  ]);
  
  const service = new google.maps.DirectionsService();
  service.route({
    origin:originLocation,
    destination:destinationLocation,
    travelMode:google.maps.TravelMode.DRIVING
  },(result, status)=>{
    if(status === "OK" && result){
      const route = result.routes[0].overview_path.map((path)=>({
        lat:path.lat(),
        lng:path.lng(),
      }));
      setRoute(route);
    }
  })
}