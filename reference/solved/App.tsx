import { useState } from 'react';
import {
  AccessTime,
  ArrowOutward,
  Build,
  CalendarMonth,
  CheckCircle,
  FilterAlt,
  LocationOn,
  MoreHoriz,
  Search,
  WarningAmber,
} from '@mui/icons-material';
import {
  Avatar,
  Box,
  Button,
  CssBaseline,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  ThemeProvider,
  Typography,
} from '@mui/material';
import { theme } from './theme';
import './styles.css';

const jobs = [
  { id: 'WO-1842', site: 'Harbor Center', task: 'Cooling unit inspection', time: '09:30', tone: 'urgent' },
  { id: 'WO-1847', site: 'North Campus', task: 'Replace access sensor', time: '10:15', tone: 'normal' },
  { id: 'WO-1851', site: 'West Depot', task: 'Generator health check', time: '11:40', tone: 'normal' },
];

const regions = [
  { name: 'North', load: 82, techs: 14 },
  { name: 'Central', load: 54, techs: 9 },
  { name: 'South', load: 68, techs: 11 },
];

const activity = [
  ['09:12', 'Maya accepted WO-1842'],
  ['08:56', 'Parts delivered to North Campus'],
  ['08:41', 'WO-1838 completed'],
];

export default function App() {
  const [region, setRegion] = useState('All regions');

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box className="app-shell">
        <Box component="header" className="topbar">
          <Stack direction="row" spacing={4} sx={{ alignItems: 'center' }}>
            <Box className="brand-mark" aria-hidden="true">R</Box>
            <Typography className="brand-name">RelayOps</Typography>
            <Stack component="nav" direction="row" spacing={0.5} aria-label="Primary navigation">
              {['Overview', 'Work orders', 'Technicians', 'Assets'].map((item, index) => (
                <Button key={item} className={index === 0 ? 'nav-active' : ''} aria-current={index === 0 ? 'page' : undefined}>
                  {item}
                </Button>
              ))}
            </Stack>
          </Stack>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <IconButton aria-label="More actions"><MoreHoriz /></IconButton>
            <Avatar className="avatar">RP</Avatar>
          </Stack>
        </Box>

        <Box component="main" className="workspace">
          <Paper className="hero" elevation={0}>
            <Box>
              <Typography className="eyebrow">Wednesday · Field operations</Typography>
              <Typography variant="h3" className="hero-title">Keep every visit on track.</Typography>
              <Typography className="hero-copy">Coordinate technicians, urgent work and service-level risk from one shared view.</Typography>
            </Box>
            <Stack direction="row" spacing={1.25} className="hero-actions">
              <TextField
                type="search"
                size="small"
                placeholder="Search work orders"
                aria-label="Search work orders"
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search /></InputAdornment> } }}
              />
              <TextField select size="small" label="Region" value={region} onChange={(event) => setRegion(event.target.value)}>
                {['All regions', 'North', 'Central', 'South'].map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
              </TextField>
              <Button variant="contained" startIcon={<CalendarMonth />}>Schedule visit</Button>
            </Stack>
          </Paper>

          <Box className="summary-strip">
            <Box><Typography className="metric-label">Open today</Typography><Typography className="metric-value">38</Typography></Box>
            <Box><Typography className="metric-label">Technicians active</Typography><Typography className="metric-value">31</Typography></Box>
            <Box><Typography className="metric-label">First-time fix</Typography><Typography className="metric-value">91.2%</Typography></Box>
            <Box>
              <Typography className="metric-label">SLA risk</Typography>
              <Stack direction="row" spacing={0.5} className="risk-delta" sx={{ alignItems: 'center' }}>
                <ArrowOutward aria-hidden="true" fontSize="small" />
                <Typography className="metric-value">Increased 12.6%</Typography>
              </Stack>
            </Box>
          </Box>

          <Box className="bento-grid">
            <Paper component="section" className="panel jobs-panel" elevation={0} aria-labelledby="jobs-heading">
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <Box><Typography id="jobs-heading" variant="h6">Next work orders</Typography><Typography className="panel-subtitle">Priority queue for the next three hours</Typography></Box>
                <IconButton aria-label="Filter work orders"><FilterAlt /></IconButton>
              </Stack>
              <Stack component="ul" className="job-list">
                {jobs.map((job) => (
                  <Box component="li" key={job.id} sx={{ listStyle: 'none' }}>
                    <Button fullWidth className="job-row">
                      <Box className={`job-icon ${job.tone}`}><Build fontSize="small" /></Box>
                      <Box className="job-copy"><Typography className="job-site">{job.site}</Typography><Typography className="job-task">{job.task}</Typography></Box>
                      <Box className="job-meta"><Typography>{job.id}</Typography><Typography><AccessTime fontSize="inherit" /> {job.time}</Typography></Box>
                    </Button>
                  </Box>
                ))}
              </Stack>
              <Button fullWidth className="view-all">View all work orders</Button>
            </Paper>

            <Paper component="section" className="panel territory-panel" elevation={0} aria-labelledby="territory-heading">
              <Box><Typography id="territory-heading" variant="h6">Territory load</Typography><Typography className="panel-subtitle">Live allocation by service region</Typography></Box>
              <Box className="territory-canvas">
                {regions.map((item, index) => (
                  <Box key={item.name} role="group" className={`territory-card zone-${index + 1}`} aria-label={`${item.name}: ${item.load}% allocated`}>
                    <LocationOn fontSize="small" />
                    <strong>{item.name}</strong>
                    <span>{item.techs} techs</span>
                  </Box>
                ))}
              </Box>
              <Stack spacing={1.25}>
                {regions.map((item) => (
                  <Box key={item.name}>
                    <Stack direction="row" sx={{ justifyContent: 'space-between' }}><Typography>{item.name}</Typography><Typography>{item.load}%</Typography></Stack>
                    <LinearProgress aria-label={`${item.name} allocation`} variant="determinate" value={item.load} />
                  </Box>
                ))}
              </Stack>
            </Paper>

            <Paper component="aside" className="panel pulse-panel" elevation={0} aria-labelledby="pulse-heading">
              <Typography id="pulse-heading" variant="h6">Operations pulse</Typography>
              <Typography className="panel-subtitle">Signals requiring attention</Typography>
              <Box className="pulse-card warning"><WarningAmber /><Box><strong>4 visits at SLA risk</strong><span>North region · next 90 min</span></Box></Box>
              <Box className="pulse-card success"><CheckCircle /><Box><strong>12 jobs closed</strong><span>91% first-time fix rate</span></Box></Box>
              <Typography className="activity-title">Recent activity</Typography>
              <Stack spacing={1.5}>
                {activity.map(([time, text]) => <Box className="activity-row" key={time}><span>{time}</span><Typography>{text}</Typography></Box>)}
              </Stack>
            </Paper>
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
