"use client";
import React, { useState, useEffect, useRef } from "react";
import { Wrapper } from "@googlemaps/react-wrapper";
import {
  PerspectiveCamera,
  Scene,
  AmbientLight,
  WebGLRenderer,
  Matrix4,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

const mapOptions = {
  mapId: process.env.NEXT_PUBLIC_MAP_ID,
  center: { lat: 43.661036, lng: -79.391277 },
  zoom: 17,
  disableDefaultUI: true,
  heading: 25,
  tilt: 25,
};

export default function Page() {
  return (
    <Wrapper apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}>
      <MyMap />
    </Wrapper>
  );
}

function MyMap() {
    const overlayRef = useRef();// Ref for the added 3dobject on the map
  const [_map, setMap] = useState();
  const ref = useRef();// Ref for the Map
  

  useEffect(() => {
    if (!overlayRef.current) {// if no 3d object is added on the map create one using createOverlay
      const instance = new window.google.maps.Map(ref.current, mapOptions);
      setMap(instance);
      overlayRef.current = createOverlay(instance);
    }
  }, []);
  return <div ref={ref} id="map" />;
}

function createOverlay(map){
    const overlay = new google.maps.WebGLOverlayView();// used to add a 3d object on top of the map
    let renderer, scene, camera, loader;
    overlay.onAdd=()=> {// set up the display once the overlay is displayed
        scene = new Scene();
        camera = new PerspectiveCamera();
        const light = new AmbientLight(0xffffff,1.0);
        scene.add(light);

        loader = new GLTFLoader();
        loader.loadAsync("/low_poly_scooter/scene.gltf").then((object) => {
          const group = object.scene;
          group.scale.setScalar(25);// size of the Object
          group.rotation.set(Math.PI / 2, 0, 0);
          group.position.setZ(-120);
          scene.add(group);
        });
    }
    overlay.onContextRestored =({gl})=>{// the context restored connects our 3d renderer to google maps' WebGl
        renderer = new WebGLRenderer({
          canvas: gl.canvas, //a special canvas provided by Google Maps
          //gl (short for "graphics library") is the WebGL context that Google Maps gave us. This context lets the renderer know it can use Google Maps’ tools to draw.
          context: gl,
          ...gl.getContextAttributes(),
        });
        renderer.autoClear = false;

        loader.manager.onLoad =()=>{
            renderer.setAnimationLoop(() => {
              map.moveCamera({
                tilt: mapOptions.tilt,
                heading: mapOptions.heading,
                zoom: mapOptions.zoom,
              });
              if (mapOptions.tilt < 60) {
                mapOptions.tilt += 0.5;
              } else if (mapOptions.zoom < 20) {
                mapOptions.zoom += 0.05;
              } else if (mapOptions.heading < 360) {
                mapOptions.heading += 0.5;
              } else {
                renderer.setAnimationLoop(null);
              }
            });
        }
    }
    overlay.onDraw =({transformer}) => {// on Draw is called every time the map is redrawn/ map updates
        const matrix = transformer.fromLatLngAltitude({
          // convert the map  coordinates to something understandable by the 3d Library
          lat: mapOptions.center.lat,
          lng: mapOptions.center.lng,
          altitude: 120,
        });
        camera.projectionMatrix = new Matrix4().fromArray(matrix);
        overlay.requestRedraw();
        renderer.render(scene,camera);
        renderer.resetState();
    }
    overlay.setMap(map);
    return overlay;
}