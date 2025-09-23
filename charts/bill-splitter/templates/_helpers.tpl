{{/*
Expand the name of the chart.
*/}}
{{- define "bill-splitter.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "bill-splitter.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "bill-splitter.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create the full image path for the frontend container.
*/}}
{{- define "bill-splitter.frontendImage" -}}
{{- printf "ghcr.io/%s/bill-splitter-frontend:%s" .Values.image.owner .Values.image.tag }}
{{- end -}}

{{/*
Create the full image path for the backend container.
*/}}
{{- define "bill-splitter.backendImage" -}}
{{- printf "ghcr.io/%s/bill-splitter-backend:%s" .Values.image.owner .Values.image.tag }}
{{- end -}}
