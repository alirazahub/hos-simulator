import { InputAdornment, TextField } from "@mui/material";
import { useTheme } from "@mui/material/styles";

const MuiInput = ({
  label,
  icon: Icon,
  value,
  onChange,
  type = "text",
  min,
  max,
  fullWidth = true,
}) => {
  const theme = useTheme();
  return (
    <TextField
      label={label}
      variant="outlined"
      type={type}
      value={value}
      onChange={onChange}
      fullWidth={fullWidth}
      size="small"
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <Icon size={18} color="action" />
          </InputAdornment>
        ),
        inputProps: {
          min: min,
          max: max,
        },
      }}
      sx={{
        "& .MuiOutlinedInput-root": {
          borderRadius: 2,
          backgroundColor: theme.palette.mode === 'dark' ? 'transparent' : 'white',
          color: 'text.primary',
          "&.Mui-focused fieldset": {
            borderColor: 'error.main',
            boxShadow: theme.palette.mode === 'dark' ? `0 0 0 2px rgba(255,111,0,0.12)` : `0 0 0 2px rgba(211,47,47,0.2)`,
          },
        },
      }}
    />
  );
};

export default MuiInput;
