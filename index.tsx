import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

// --- TypeScript Interfaces for structured data ---
interface Segment {
    segment: number;
    driveTime: string;
    distance: number;
    arrivalLocation: string;
    stopType: string;
    state: string;
    safety: string;
}

interface Summary {
    totalDistance: string;
    totalDays: string;
    fuelRequired: string;
    fuelCost: string;
}

interface Journey {
    origin: string;
    destination: string;
    summary: Summary;
    segments: Segment[];
}

const App: React.FC = () => {
    const [origin, setOrigin] = useState('');
    const [destinations, setDestinations] = useState('');
    const [journeys, setJourneys] = useState<Journey[] | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // --- Gemini API Schema Definition ---
    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        journeys: {
          type: Type.ARRAY,
          description: "An array of journey plans, one for each destination.",
          items: {
            type: Type.OBJECT,
            properties: {
              origin: { type: Type.STRING },
              destination: { type: Type.STRING },
              summary: {
                type: Type.OBJECT,
                properties: {
                  totalDistance: { type: Type.STRING },
                  totalDays: { type: Type.STRING },
                  fuelRequired: { type: Type.STRING },
                  fuelCost: { type: Type.STRING },
                },
                required: ["totalDistance", "totalDays", "fuelRequired", "fuelCost"]
              },
              segments: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    segment: { type: Type.NUMBER },
                    driveTime: { type: Type.STRING },
                    distance: { type: Type.NUMBER },
                    arrivalLocation: { type: Type.STRING },
                    stopType: { type: Type.STRING },
                    state: { type: Type.STRING },
                    safety: { type: Type.STRING },
                  },
                  required: ["segment", "driveTime", "distance", "arrivalLocation", "stopType", "state", "safety"]
                }
              }
            },
            required: ["origin", "destination", "summary", "segments"]
          }
        }
      },
      required: ["journeys"]
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!origin.trim() || !destinations.trim()) {
            setError("Please provide both an origin and at least one destination.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setJourneys(null);

        const prompt = `I want you to create a **comprehensive journey management plan** for my haulage firm, where:

* I provide **one origin city** and **multiple destinations** in Nigeria.
* Each destination should be treated as a **separate trip from the origin** (not continuous).

**Driving & Rest Rules:**

* Drive 4 hours (240 km) → Rest 1 hour
* Drive 4 hours (240 km) → Rest 1 hour
* Drive 2 hours (120 km) → Park for the day
* Maximum 600 km per day at an average speed of 60 km/h
* Fuel consumption: 2.0 km/L
* Diesel cost: ₦1,250/L

**Requirements:**

1. For each destination, plan the route from the origin using actual road distances.
2. Break the journey into **daily segments** according to the driving rules above.
3. At each rest stop and parking point, provide:

    * Town/City name
    * State
    * Distance travelled so far
    * Time of arrival
    * Stop type (Rest or Park)
    * Safety status (Safe / Moderate / Not Safe)
4. Always choose rest and park points in safe and accessible locations, preferably near major towns with fuel stations, lodging, and security presence.
5. If a rest or park point falls in an unsafe area, adjust to the nearest safer town and note the change.

**Output format for each destination:**

**Origin → Destination Name**

| Segment | Drive Time | Distance (km) | Arrival Location | Stop Type | State | Safety   |
| ------- | ---------- | ------------- | ---------------- | --------- | ----- | -------- |
| 1       | 4 hrs      | 240           | XYZ Town         | Rest      | State | Safe     |
| 2       | 4 hrs      | 480           | ABC City         | Rest      | State | Moderate |
| 3       | 2 hrs      | 600           | DEF Town         | Park      | State | Safe     |

**Trip Summary:**

* Total Distance: X km
* Total Days: X days
* Fuel Required: X litres
* Fuel Cost: ₦X

Repeat this separately for each destination given.

---
**Journey Details:**

Origin: ${origin}
Destinations:
${destinations}
`;

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const response: GenerateContentResponse = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                },
            });

            const jsonText = response.text.trim();
            const result = JSON.parse(jsonText);
            setJourneys(result.journeys);

        } catch (err) {
            console.error(err);
            setError("An error occurred while generating the journey plan. The model might be unable to find routes or has produced an invalid response. Please check your locations and try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <header>
                <h1>Nigerian Haulage Journey Planner</h1>
            </header>
            <main className="container">
                <aside className="form-container">
                    <h2>Plan Your Journeys</h2>
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="origin">Origin City</label>
                            <input
                                id="origin"
                                type="text"
                                value={origin}
                                onChange={(e) => setOrigin(e.target.value)}
                                placeholder="e.g., Lagos"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="destinations">Destination Cities (one per line)</label>
                            <textarea
                                id="destinations"
                                value={destinations}
                                onChange={(e) => setDestinations(e.target.value)}
                                placeholder="e.g., Kano&#10;Abuja&#10;Port Harcourt"
                                required
                            />
                        </div>
                        <button type="submit" className="submit-button" disabled={isLoading || !origin || !destinations}>
                            {isLoading && <span className="loader"></span>}
                            {isLoading ? 'Planning...' : 'Plan Journeys'}
                        </button>
                    </form>
                </aside>
                <section className="results-container" aria-live="polite">
                    {isLoading && <ResultsPlaceholder text="Generating your comprehensive journey plans..." />}
                    {error && <div className="error-message">{error}</div>}
                    {!isLoading && !error && journeys && journeys.map((journey, index) => (
                        <JourneyCard key={index} journey={journey} />
                    ))}
                    {!isLoading && !error && !journeys && <ResultsPlaceholder text="Your journey plans will appear here." />}
                </section>
            </main>
        </>
    );
};

const JourneyCard: React.FC<{ journey: Journey }> = ({ journey }) => (
    <details className="journey-card" open>
        <summary>{journey.origin} → {journey.destination}</summary>
        <div className="journey-content">
            <h3>Trip Summary</h3>
            <div className="summary-grid">
                <div className="summary-item">
                    <span>Total Distance</span>
                    <span>{journey.summary.totalDistance}</span>
                </div>
                <div className="summary-item">
                    <span>Total Days</span>
                    <span>{journey.summary.totalDays}</span>
                </div>
                <div className="summary-item">
                    <span>Fuel Required</span>
                    <span>{journey.summary.fuelRequired}</span>
                </div>
                <div className="summary-item">
                    <span>Fuel Cost</span>
                    <span>{journey.summary.fuelCost}</span>
                </div>
            </div>

            <h3>Route Plan</h3>
            <div className="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Segment</th>
                            <th>Drive Time</th>
                            <th>Distance (km)</th>
                            <th>Arrival Location</th>
                            <th>Stop Type</th>
                            <th>State</th>
                            <th>Safety</th>
                        </tr>
                    </thead>
                    <tbody>
                        {journey.segments.map((segment, index) => (
                            <tr key={index}>
                                <td>{segment.segment}</td>
                                <td>{segment.driveTime}</td>
                                <td>{segment.distance.toLocaleString()}</td>
                                <td>{segment.arrivalLocation}</td>
                                <td>{segment.stopType}</td>
                                <td>{segment.state}</td>
                                <td>{segment.safety}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    </details>
);

const ResultsPlaceholder: React.FC<{ text: string }> = ({ text }) => (
    <div className="results-placeholder">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.875 5.688c-.748.374-1.223 1.144-1.223 1.994v8.309c0 .85.475 1.62 1.223 1.994l4.875 2.437c.317.159.69.159 1.006 0l4.125-2.063a1.125 1.125 0 00.503-1.006z" />
        </svg>
        <p>{text}</p>
    </div>
);


const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);