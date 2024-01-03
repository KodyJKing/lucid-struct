import React from 'react'
import { createRoot } from 'react-dom/client'
import './utils.css'
import './style.css'
import App from './components/App'

const container = document.getElementById( 'root' )

const root = createRoot( container! )

root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
)
