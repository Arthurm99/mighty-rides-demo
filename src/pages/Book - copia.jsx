import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Book() {
  const navigate = useNavigate();
  const fromInputRef = useRef(null);
  const toInputRef = useRef(null);
  
  // Estados del formulario
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    from: '',
    to: '',
    fromPlaceId: '',
    toPlaceId: '',
    date: '',
    time: '',
    serviceType: 'one-way',
    selectedVehicle: 'standard', // Nuevo estado para tipo de vehículo
    passengers: '1',
    notes: ''
  });
  
  const [currentStep, setCurrentStep] = useState(1);
  const [estimatedPrice, setEstimatedPrice] = useState(0);
  const [isCalculating, setIsCalculating] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);
  const [quotaWarning, setQuotaWarning] = useState(false);

  // ⚠️ REEMPLAZA CON TU API KEY REAL
  const GOOGLE_MAPS_API_KEY = 'AIzaSyAoS15xiN1TTWmkeT-oz95e7kmULnbt_cE';

  // Configuración de precios
  const priceConfig = {
    baseFare: 3.50,
    perMile: 1.85,
    perMinute: 0.35,
    airportSurcharge: 5.00,
    hourlyRate: 45,
    minimumFare: 8.50,
    
    // Tipos de vehículos tipo Uber
    vehicleTypes: {
      'standard': {
        name: 'Standard Ride',
        description: 'Sedan 4 puestos',
        multiplier: 1.0,
        capacity: 4,
        icon: '🚗'
      },
      'xl': {
        name: 'XL Ride', 
        description: 'Mini van 6 puestos',
        multiplier: 1.5,
        capacity: 6,
        icon: '🚐'
      },
      'luxury': {
        name: 'Luxury Ride',
        description: 'Suburbans de lujo', 
        multiplier: 2.2,
        capacity: 4,
        icon: '🖤'
      }
    },
    
    serviceTypes: {
      'one-way': { 
        multiplier: 1, 
        name: 'One Way / Solo Ida',
        description: 'Standard rate'
      },
      'round-trip': { 
        multiplier: 1.9, 
        name: 'Round Trip / Ida y Vuelta',
        description: 'Save 10%'
      },
      'hourly': { 
        multiplier: 0, 
        name: 'Hourly Service / Por Horas',
        description: 'Multiple stops'
      },
      'airport': { 
        multiplier: 1.1, 
        name: 'Airport Transfer / Traslado Aeropuerto',
        description: 'Meet & greet included'
      }
    },
    
    demandMultipliers: {
      peak: 1.3,
      weekend: 1.15,
      late: 1.2,
      normal: 1.0
    }
  };

  // Cargar Google Maps
  useEffect(() => {
    if (window.google && window.google.maps && window.google.maps.places) {
      setIsGoogleLoaded(true);
      return;
    }

    if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === 'TU_API_KEY_AQUI') {
      console.error('⚠️ Google Maps API Key not configured!');
      setQuotaWarning(true);
      return;
    }

    const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`);
    if (existingScript) {
      const checkInterval = setInterval(() => {
        if (window.google && window.google.maps && window.google.maps.places) {
          setIsGoogleLoaded(true);
          clearInterval(checkInterval);
        }
      }, 500);
      return () => clearInterval(checkInterval);
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&loading=async`;
    script.async = true;
    script.onload = () => {
      if (window.google && window.google.maps && window.google.maps.places) {
        setIsGoogleLoaded(true);
      }
    };
    script.onerror = () => setQuotaWarning(true);
    document.head.appendChild(script);
  }, []);

  // Inicializar Autocomplete
  useEffect(() => {
    if (!isGoogleLoaded) return;

    const initAutocomplete = (inputRef, field) => {
      if (!inputRef.current) return null;

      const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'us' },
        fields: ['place_id', 'formatted_address', 'geometry', 'name'],
        types: ['geocode']
      });

      const orlandoBounds = new window.google.maps.LatLngBounds(
        new window.google.maps.LatLng(28.0, -82.0),
        new window.google.maps.LatLng(29.0, -81.0)
      );
      autocomplete.setBounds(orlandoBounds);

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (!place.place_id) return;

        setFormData(prev => ({
          ...prev,
          [field]: place.formatted_address || place.name,
          [`${field}PlaceId`]: place.place_id,
          [`${field}Coordinates`]: place.geometry?.location ? {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng()
          } : null
        }));

        if (errors[field]) {
          setErrors(prev => ({ ...prev, [field]: '' }));
        }
      });

      return autocomplete;
    };

    const fromAutocomplete = initAutocomplete(fromInputRef, 'from');
    const toAutocomplete = initAutocomplete(toInputRef, 'to');

    return () => {
      if (fromAutocomplete && window.google) {
        window.google.maps.event.clearInstanceListeners(fromAutocomplete);
      }
      if (toAutocomplete && window.google) {
        window.google.maps.event.clearInstanceListeners(toAutocomplete);
      }
    };
  }, [isGoogleLoaded, errors]);

  // Calcular distancia real
  const calculateRealDistance = async (fromPlaceId, toPlaceId) => {
    if (!window.google || !fromPlaceId || !toPlaceId) return null;

    return new Promise((resolve) => {
      const service = new window.google.maps.DistanceMatrixService();
      
      service.getDistanceMatrix({
        origins: [{ placeId: fromPlaceId }],
        destinations: [{ placeId: toPlaceId }],
        travelMode: window.google.maps.TravelMode.DRIVING,
        unitSystem: window.google.maps.UnitSystem.IMPERIAL,
        drivingOptions: {
          departureTime: formData.date && formData.time ? 
            new Date(`${formData.date}T${formData.time}`) : new Date(),
          trafficModel: window.google.maps.TrafficModel.BEST_GUESS
        }
      }, (response, status) => {
        if (status === window.google.maps.DistanceMatrixStatus.OK) {
          const result = response.rows[0].elements[0];
          
          if (result.status === 'OK') {
            const distance = result.distance.value * 0.000621371;
            const duration = result.duration_in_traffic 
              ? result.duration_in_traffic.value / 60 
              : result.duration.value / 60;
            
            resolve({
              distance: Math.round(distance * 10) / 10,
              time: Math.round(duration),
              hasTrafficData: !!result.duration_in_traffic
            });
          } else {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
    });
  };

  // Calcular multiplicador de demanda
  const getDemandMultiplier = (date, time) => {
    if (!date || !time) return priceConfig.demandMultipliers.normal;
    
    const selectedDate = new Date(`${date}T${time}`);
    const hour = selectedDate.getHours();
    const dayOfWeek = selectedDate.getDay();
    
    if (hour >= 22 || hour <= 5) return priceConfig.demandMultipliers.late;
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
        return priceConfig.demandMultipliers.peak;
      }
    }
    if (dayOfWeek === 0 || dayOfWeek === 6 || (dayOfWeek === 5 && hour >= 18)) {
      return priceConfig.demandMultipliers.weekend;
    }
    
    return priceConfig.demandMultipliers.normal;
  };

  // Calcular precio
  const calculatePrice = async () => {
    if (!formData.fromPlaceId || !formData.toPlaceId) return;
    
    setIsCalculating(true);
    
    try {
      const routeData = await calculateRealDistance(formData.fromPlaceId, formData.toPlaceId);
      if (!routeData) {
        setIsCalculating(false);
        return;
      }

      const { distance, time, hasTrafficData } = routeData;
      
      // Calcular precio base
      let basePrice = priceConfig.baseFare + (time * priceConfig.perMinute) + (distance * priceConfig.perMile);
      
      // Aplicar multiplicador del tipo de servicio
      const serviceMultiplier = priceConfig.serviceTypes[formData.serviceType]?.multiplier || 1;
      if (serviceMultiplier > 0) {
        basePrice *= serviceMultiplier;
      }
      
      // Detectar aeropuerto
      const isAirportTrip = formData.from.toLowerCase().includes('airport') || 
                           formData.to.toLowerCase().includes('airport') ||
                           formData.from.toLowerCase().includes('mco') || 
                           formData.to.toLowerCase().includes('mco');
      
      if (formData.serviceType === 'airport' || isAirportTrip) {
        basePrice += priceConfig.airportSurcharge;
      }
      
      // Aplicar multiplicador de demanda
      const demandMultiplier = getDemandMultiplier(formData.date, formData.time);
      if (demandMultiplier > 1) {
        basePrice *= demandMultiplier;
        setFormData(prev => ({ ...prev, surgeActive: demandMultiplier }));
      } else {
        setFormData(prev => ({ ...prev, surgeActive: null }));
      }
      
      // Calcular precios para cada tipo de vehículo
      const vehiclePrices = {};
      Object.entries(priceConfig.vehicleTypes).forEach(([key, vehicle]) => {
        let vehiclePrice = basePrice * vehicle.multiplier;
        vehiclePrice = Math.max(vehiclePrice, priceConfig.minimumFare);
        vehiclePrices[key] = Math.round(vehiclePrice * 100) / 100;
      });
      
      // Calcular hora de llegada
      const now = new Date();
      const departureTime = formData.date && formData.time ? 
        new Date(`${formData.date}T${formData.time}`) : now;
      const arrivalTime = new Date(departureTime.getTime() + (time * 60000));
      
      setFormData(prev => ({
        ...prev,
        vehiclePrices,
        priceBreakdown: {
          baseFare: priceConfig.baseFare,
          timeCharge: time * priceConfig.perMinute,
          distanceCharge: distance * priceConfig.perMile,
          airportSurcharge: (formData.from.toLowerCase().includes('airport') || 
                           formData.to.toLowerCase().includes('airport') ||
                           formData.from.toLowerCase().includes('mco') || 
                           formData.to.toLowerCase().includes('mco')) ? priceConfig.airportSurcharge : 0,
          demandMultiplier: getDemandMultiplier(formData.date, formData.time),
          estimatedDistance: distance,
          estimatedTime: time,
          hasTrafficData: hasTrafficData,
          arrivalTime: arrivalTime.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
          })
        }
      }));
      
      // Establecer precio del vehículo seleccionado
      setEstimatedPrice(vehiclePrices[formData.selectedVehicle]);
      
    } catch (error) {
      console.error('Error calculating price:', error);
    } finally {
      setIsCalculating(false);
    }
  };

  // Validaciones
  const validateStep = (step) => {
    const newErrors = {};
    
    if (step >= 1) {
      if (!formData.name.trim()) newErrors.name = 'Name required';
      if (!formData.email.trim()) newErrors.email = 'Email required';
      if (!formData.phone.trim()) newErrors.phone = 'Phone required';
      if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
        newErrors.email = 'Invalid email';
      }
    }
    
    if (step >= 2) {
      if (!formData.from.trim()) newErrors.from = 'Pickup location required';
      if (!formData.to.trim()) newErrors.to = 'Destination required';
      if (!formData.fromPlaceId) newErrors.from = 'Please select from suggestions';
      if (!formData.toPlaceId) newErrors.to = 'Please select from suggestions';
      if (!formData.date) newErrors.date = 'Date required';
      if (!formData.time) newErrors.time = 'Time required';
      
      const selectedDateTime = new Date(`${formData.date}T${formData.time}`);
      if (selectedDateTime <= new Date()) {
        newErrors.date = 'Date must be in the future';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Recalcular precio cuando cambien ubicaciones o vehículo seleccionado
  useEffect(() => {
    if (formData.fromPlaceId && formData.toPlaceId && formData.serviceType && isGoogleLoaded) {
      calculatePrice();
    }
  }, [formData.fromPlaceId, formData.toPlaceId, formData.serviceType, formData.selectedVehicle, formData.date, formData.time, isGoogleLoaded]);

  // Actualizar precio cuando cambie el vehículo seleccionado
  useEffect(() => {
    if (formData.vehiclePrices && formData.selectedVehicle) {
      setEstimatedPrice(formData.vehiclePrices[formData.selectedVehicle]);
    }
  }, [formData.selectedVehicle, formData.vehiclePrices]);

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 3));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep(2)) return;

    setIsSubmitting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      navigate('/thankyou');
    } catch (error) {
      alert('Error sending form');
    } finally {
      setIsSubmitting(false);
    }
  };

  const ProgressBar = () => (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-2">
        {[1, 2, 3].map((step) => (
          <div
            key={step}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step <= currentStep ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}
          >
            {step}
          </div>
        ))}
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${(currentStep / 3) * 100}%` }}
        ></div>
      </div>
      <div className="flex justify-between text-xs text-gray-500 mt-1">
        <span>Contact</span>
        <span>Trip & Schedule</span>
        <span>Confirm</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white p-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Book Your Ride / Reserva tu Viaje
          </h1>
          <p className="text-gray-600">
            Safe and reliable transportation
          </p>
          
          {!isGoogleLoaded && !quotaWarning && (
            <div className="text-sm text-blue-600 mt-2">
              Loading Google Maps...
            </div>
          )}
          
          {quotaWarning && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-4">
              <p className="text-sm text-yellow-800">
                ⚠️ Please configure your Google Maps API key
              </p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <ProgressBar />

          <form onSubmit={handleSubmit}>
            {/* Paso 1: Contact */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold mb-4">Contact Information</h2>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      errors.name ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Your full name"
                  />
                  {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      errors.email ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="your@email.com"
                  />
                  {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone *</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      errors.phone ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="+1 (555) 123-4567"
                  />
                  {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
                </div>
              </div>
            )}

            {/* Paso 2: Trip Details */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold mb-4">Trip Details</h2>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    From * <span className="text-xs text-green-600">🗺️ Google Maps</span>
                  </label>
                  <input
                    ref={fromInputRef}
                    type="text"
                    name="from"
                    value={formData.from}
                    onChange={handleChange}
                    disabled={!isGoogleLoaded}
                    className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      errors.from ? 'border-red-500' : 'border-gray-300'
                    } ${!isGoogleLoaded ? 'bg-gray-100' : ''}`}
                    placeholder={isGoogleLoaded ? "Start typing address..." : "Loading..."}
                  />
                  {errors.from && <p className="text-red-500 text-sm mt-1">{errors.from}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    To * <span className="text-xs text-green-600">🗺️ Google Maps</span>
                  </label>
                  <input
                    ref={toInputRef}
                    type="text"
                    name="to"
                    value={formData.to}
                    onChange={handleChange}
                    disabled={!isGoogleLoaded}
                    className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      errors.to ? 'border-red-500' : 'border-gray-300'
                    } ${!isGoogleLoaded ? 'bg-gray-100' : ''}`}
                    placeholder={isGoogleLoaded ? "Start typing destination..." : "Loading..."}
                  />
                  {errors.to && <p className="text-red-500 text-sm mt-1">{errors.to}</p>}
                </div>

                {/* Ride Pricing con opciones tipo Uber */}
                {(formData.fromPlaceId && formData.toPlaceId) && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-medium text-green-900">
                        🚗 Ride Pricing
                      </span>
                      <div className="text-right">
                        {isCalculating ? (
                          <div className="flex items-center gap-2">
                            <div className="animate-spin h-6 w-6 border-2 border-green-600 border-t-transparent rounded-full"></div>
                            <span className="text-sm text-green-600">Calculating...</span>
                          </div>
                        ) : (
                          <div>
                            <span className="text-3xl font-bold text-green-600">
                              ${estimatedPrice}
                            </span>
                            {formData.surgeActive && formData.surgeActive > 1 && (
                              <div className="text-sm text-orange-600 font-medium">
                                {formData.surgeActive}x Higher demand
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Información del viaje */}
                    {formData.priceBreakdown && !isCalculating && (
                      <div className="bg-white rounded-lg p-4 border border-green-200">
                        <div className="grid grid-cols-2 gap-4 text-center text-sm">
                          <div>
                            <div className="font-medium text-gray-900">Distance</div>
                            <div className="text-green-600">{formData.priceBreakdown.estimatedDistance} miles</div>
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">Travel Time</div>
                            <div className="text-green-600">{formData.priceBreakdown.estimatedTime} minutes</div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Selector de vehículos tipo Uber */}
                    {formData.vehiclePrices && !isCalculating && (
                      <div className="space-y-3">
                        <h4 className="font-medium text-green-900 mb-3">Choose your ride:</h4>
                        {Object.entries(priceConfig.vehicleTypes).map(([key, vehicle]) => (
                          <div
                            key={key}
                            onClick={() => setFormData(prev => ({ ...prev, selectedVehicle: key }))}
                            className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                              formData.selectedVehicle === key
                                ? 'border-green-500 bg-green-100'
                                : 'border-gray-200 hover:border-green-300 bg-white'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="text-2xl">{vehicle.icon}</span>
                                <div>
                                  <div className="font-medium text-gray-900">{vehicle.name}</div>
                                  <div className="text-sm text-gray-600">{vehicle.description}</div>
                                  <div className="text-xs text-gray-500">Capacity: {vehicle.capacity} passengers</div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-xl font-bold text-green-600">
                                  ${formData.vehiclePrices[key]}
                                </div>
                                {formData.selectedVehicle === key && (
                                  <div className="text-sm text-green-600">✓ Selected</div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>                     
             )}
                    
                    <p className="text-sm text-green-700">
                      🗺️ Real Google Maps distance and traffic-based timing
                    </p>
                  </div>
                )}
                 {/* Schedule Section */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <h3 className="text-lg font-semibold mb-4">Schedule Your Trip</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
                      <input
                        type="date"
                        name="date"
                        value={formData.date}
                        onChange={handleChange}
                        min={new Date().toISOString().split('T')[0]}
                        className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                          errors.date ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.date && <p className="text-red-500 text-sm mt-1">{errors.date}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Time *</label>
                      <input
                        type="time"
                        name="time"
                        value={formData.time}
                        onChange={handleChange}
                        className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                          errors.time ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.time && <p className="text-red-500 text-sm mt-1">{errors.time}</p>}
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Special Notes</label>
                    <textarea
                      name="notes"
                      value={formData.notes}
                      onChange={handleChange}
                      rows="3"
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Child seats, luggage, special requirements..."
                    ></textarea>
                  </div>
                </div>
              </div>
            )}

            
            
           {/* Paso 3: Confirmation */}
            {currentStep === 3 && (
            
              <div className="space-y-6">
                <h2 className="text-xl font-semibold mb-4">Confirm Booking</h2>
                
                <div className="bg-gray-50 p-6 rounded-lg space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Name:</span>
                      <p>{formData.name}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Email:</span>
                      <p>{formData.email}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Phone:</span>
                      <p>{formData.phone}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Service:</span>
                      <p>{priceConfig.serviceTypes[formData.serviceType]?.name}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">From:</span>
                      <p>{formData.from}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">To:</span>
                      <p>{formData.to}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Date & Time:</span>
                      <p>{formData.date} at {formData.time}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Passengers:</span>
                      <p>{formData.passengers}</p>
                    </div>
                  </div>
                  
                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center text-lg font-semibold">
                      <span>Google Maps Total:</span>
                      <div>
                        <span className="text-green-600">${estimatedPrice}</span>
                        {formData.surgeActive && formData.surgeActive > 1 && (
                          <span className="text-sm text-orange-600 ml-2">
                            ({formData.surgeActive}x demand)
                          </span>
                        )}
                      </div>
                    </div>
                    {formData.priceBreakdown && (
                      <div className="text-sm text-gray-600 mt-2">
                        🗺️ Real distance: {formData.priceBreakdown.estimatedDistance} miles • 
                        Time: {formData.priceBreakdown.estimatedTime} minutes 
                        {formData.priceBreakdown.hasTrafficData && " (with traffic)"}
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-green-800">
                    ✅ <strong>Google Maps Integration:</strong> Your booking uses real-time data 
                    for accurate pricing. We'll contact you within 1 hour to confirm.
                  </p>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8">
              <button
                type="button"
                onClick={prevStep}
                className={`px-6 py-3 rounded-lg font-medium ${
                  currentStep === 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                disabled={currentStep === 1}
              >
                ← Previous
              </button>

 {currentStep < 3 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  disabled={!isGoogleLoaded && currentStep === 2}
                  className={`px-6 py-3 rounded-lg font-medium ${
                    !isGoogleLoaded && currentStep === 2
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {!isGoogleLoaded && currentStep === 2 ? 'Loading Maps...' : 'Next →'}
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-8 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                      Sending...
                    </>
                  ) : (
                    '🗺️ Confirm Booking'
                  )}
                </button>
              )}

            </div>
          </form>
        </div>
      </div>
    </div>
  );
}